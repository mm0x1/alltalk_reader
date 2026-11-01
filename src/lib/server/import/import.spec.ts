import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { htmlToBlocks } from './html';
import { parseEpub, resolvePath } from './epub';
import { readZip, ZipLimitError } from './zip';
import { decodeText, parsePaste, stripGutenberg, stripUnderscoreEmphasis } from './txt';
import { importFile, ImportError } from './index';
import { sniffImage } from './sniff';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function xhtml(body: string): string {
	return `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>ignored</title><style>p { color: red }</style></head><body>${body}</body></html>`;
}

interface FixtureOptions {
	version?: 2 | 3;
	chapters?: { file: string; body: string; title?: string }[];
	cover?: boolean;
	extra?: Zippable;
	/** Where the text starts: an EPUB 2 guide entry, or an EPUB 3 bodymatter landmark. */
	textStart?: string;
}

/** Builds a small but structurally real EPUB. */
function buildEpub(options: FixtureOptions = {}): Uint8Array {
	const version = options.version ?? 3;
	const chapters = options.chapters ?? [
		{ file: 'text/ch1.xhtml', body: '<h1>Chapter 1</h1><p>First chapter text.</p>', title: 'One' },
		{ file: 'text/ch2.xhtml', body: '<h1>Chapter 2</h1><p>Second chapter text.</p>', title: 'Two' }
	];
	const manifest = chapters
		.map((c, i) => `<item id="c${i}" href="${c.file}" media-type="application/xhtml+xml"/>`)
		.join('');
	const spine = chapters.map((_, i) => `<itemref idref="c${i}"/>`).join('');
	const titled = chapters.filter((c) => c.title);
	const nav = xhtml(
		`<nav epub:type="toc"><ol>${titled
			.map((c) => `<li><a href="${c.file}#start">${c.title}</a></li>`)
			.join('')}</ol></nav>` +
			(options.textStart
				? `<nav epub:type="landmarks"><ol><li><a epub:type="bodymatter" href="${options.textStart}">Start</a></li></ol></nav>`
				: '')
	);
	const ncx = `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>${titled
		.map(
			(c, i) =>
				`<navPoint id="n${i}"><navLabel><text>${c.title}</text></navLabel><content src="${c.file}"/></navPoint>`
		)
		.join('')}</navMap></ncx>`;
	const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>The Test Book</dc:title><dc:creator>Ada Writer</dc:creator><dc:language>en</dc:language>
${options.cover && version === 2 ? '<meta name="cover" content="cover-img"/>' : ''}
</metadata>
<manifest>${manifest}
${version === 3 ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'}
${options.cover ? `<item id="cover-img" href="images/cover.png" media-type="image/png"${version === 3 ? ' properties="cover-image"' : ''}/>` : ''}
</manifest>
<spine${version === 2 ? ' toc="ncx"' : ''}>${spine}</spine>
${options.textStart && version === 2 ? `<guide><reference type="text" title="Start" href="${options.textStart}"/></guide>` : ''}
</package>`;
	const files: Zippable = {
		mimetype: [strToU8('application/epub+zip'), { level: 0 }],
		'META-INF/container.xml': strToU8(
			`<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
		),
		'OEBPS/content.opf': strToU8(opf),
		...(version === 3 ? { 'OEBPS/nav.xhtml': strToU8(nav) } : { 'OEBPS/toc.ncx': strToU8(ncx) }),
		...(options.cover ? { 'OEBPS/images/cover.png': PNG } : {}),
		...options.extra
	};
	for (const c of chapters) files[`OEBPS/${c.file}`] = strToU8(xhtml(c.body));
	return zipSync(files);
}

/** Re-zips an EPUB after editing its nav document. */
function rebuild(epub: Uint8Array, editNav: (nav: string) => string) {
	const entries = unzipSync(epub);
	entries['OEBPS/nav.xhtml'] = strToU8(editNav(strFromU8(entries['OEBPS/nav.xhtml'])));
	return zipSync(entries);
}

describe('htmlToBlocks', () => {
	it('extracts paragraphs and headings, dropping scripts, styles and the head', () => {
		const { blocks } = htmlToBlocks(
			xhtml(
				'<h2>The <em>Start</em></h2><p>Hello <b>bold</b> world.</p><script>alert(1)</script><p>Bye &amp; thanks.</p>'
			)
		);
		expect(blocks).toEqual([
			{ type: 'heading', text: 'The Start' },
			{ type: 'text', text: 'Hello bold world.' },
			{ type: 'text', text: 'Bye & thanks.' }
		]);
	});

	it('keeps line breaks for verse and turns rules and asterisms into breaks', () => {
		const { blocks } = htmlToBlocks(
			xhtml('<p>Roses are red,<br/>violets are blue.</p><hr/><p>* * *</p><p>After.</p>')
		);
		expect(blocks).toEqual([
			{ type: 'text', text: 'Roses are red,\nviolets are blue.' },
			{ type: 'break' },
			{ type: 'text', text: 'After.' }
		]);
	});

	it('reads drop-cap images as their letter', () => {
		const { blocks } = htmlToBlocks(
			'<p><span><img alt="M" src="m.png"/></span>R. BENNET was <img alt="a picture" src="x.png"/>here.</p>'
		);
		expect(blocks).toEqual([{ type: 'text', text: 'MR. BENNET was here.' }]);
	});

	it('never keeps markup, even when the text looks like HTML', () => {
		const { blocks } = htmlToBlocks('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
		expect(blocks).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)>' }]);
	});
});

describe('resolvePath', () => {
	it('resolves relative hrefs and drops fragments', () => {
		expect(resolvePath('OEBPS/content.opf', 'text/ch%201.xhtml#x')).toBe('OEBPS/text/ch 1.xhtml');
		expect(resolvePath('OEBPS/text/nav.xhtml', '../images/a.png')).toBe('OEBPS/images/a.png');
	});

	it('cannot escape the archive or point elsewhere', () => {
		expect(resolvePath('OEBPS/content.opf', '../../../../etc/passwd')).toBe('etc/passwd');
		expect(resolvePath('OEBPS/content.opf', 'https://evil.example/x')).toBeNull();
		expect(resolvePath('OEBPS/content.opf', 'file:///etc/passwd')).toBeNull();
	});
});

describe('parseEpub', () => {
	it('reads an EPUB 3 with nav, metadata and cover', () => {
		const book = parseEpub(buildEpub({ cover: true }), 'test.epub');
		expect(book.title).toBe('The Test Book');
		expect(book.author).toBe('Ada Writer');
		expect(book.language).toBe('en');
		expect(book.chapters.map((c) => c.title)).toEqual(['One', 'Two']);
		expect(book.chapters[0].blocks).toEqual([
			{ type: 'heading', text: 'Chapter 1' },
			{ type: 'text', text: 'First chapter text.' }
		]);
		expect(book.cover?.mime).toBe('image/png');
	});

	it('reads an EPUB 2 with an NCX', () => {
		const book = parseEpub(buildEpub({ version: 2, cover: true }), 'test.epub');
		expect(book.chapters.map((c) => c.title)).toEqual(['One', 'Two']);
		expect(book.cover?.mime).toBe('image/png');
	});

	it('joins files without their own TOC entry to the chapter before', () => {
		const book = parseEpub(
			buildEpub({
				chapters: [
					{ file: 'a.xhtml', body: '<p>Part one.</p>', title: 'Chapter A' },
					{ file: 'a_split.xhtml', body: '<p>Part two.</p>' },
					{ file: 'b.xhtml', body: '<p>Next.</p>', title: 'Chapter B' }
				]
			}),
			'x.epub'
		);
		expect(book.chapters.map((c) => c.title)).toEqual(['Chapter A', 'Chapter B']);
		expect(book.chapters[0].blocks).toHaveLength(2);
	});

	it('gives the title of an empty title page to the chapter after it', () => {
		const book = parseEpub(
			buildEpub({
				chapters: [
					{ file: 'p1.xhtml', body: '<img src="x.png"/>', title: 'Part One' },
					{ file: 'c1.xhtml', body: '<p>Text.</p>' }
				]
			}),
			'x.epub'
		);
		expect(book.chapters.map((c) => c.title)).toEqual(['Part One']);
	});

	it('splits a document into chapters at the anchors its table of contents points to', () => {
		const body =
			'<div id="front"><p>Front matter.</p></div>' +
			'<h2 id="c1">Caption. CHAPTER I.</h2><p>One.</p><p>Still one.</p>' +
			'<h2 id="c2">CHAPTER II.</h2><p>Two.</p>';
		const epub = buildEpub({ chapters: [{ file: 'all.xhtml', body }] });
		// Point the nav at fragments inside the one file.
		const book = parseEpub(
			rebuild(epub, (nav) =>
				nav.replace(
					/<ol>.*<\/ol>/s,
					'<ol><li><a href="all.xhtml#c1">He rode. CHAPTER I.</a></li><li><a href="all.xhtml#c2">CHAPTER II.</a></li></ol>'
				)
			),
			'x.epub'
		);
		expect(book.chapters.map((c) => c.title)).toEqual(['Section 1', 'CHAPTER I.', 'CHAPTER II.']);
		expect(book.chapters[1].blocks).toEqual([
			{ type: 'heading', text: 'Caption. CHAPTER I.' },
			{ type: 'text', text: 'One.' },
			{ type: 'text', text: 'Still one.' }
		]);
	});

	it('removes the Project Gutenberg header and licence', () => {
		const book = parseEpub(
			buildEpub({
				chapters: [
					{
						file: 'a.xhtml',
						body: '<p>The Project Gutenberg eBook</p><p>*** START OF THE PROJECT GUTENBERG EBOOK X ***</p><p>Story.</p>',
						title: 'Book'
					},
					{
						file: 'b.xhtml',
						body: '<p>End.</p><p>*** END OF THE PROJECT GUTENBERG EBOOK X ***</p><p>Licence.</p>',
						title: 'Last'
					},
					{ file: 'c.xhtml', body: '<p>More licence.</p>', title: 'LICENSE' }
				]
			}),
			'x.epub'
		);
		expect(book.chapters.map((c) => c.title)).toEqual(['Book', 'Last']);
		expect(book.chapters[0].blocks).toEqual([{ type: 'text', text: 'Story.' }]);
		expect(book.chapters[1].blocks).toEqual([{ type: 'text', text: 'End.' }]);
	});

	it('treats line breaks in the HTML source as spaces', () => {
		const book = parseEpub(
			buildEpub({
				chapters: [{ file: 'a.xhtml', body: '<p>Hard\nwrapped\n  source.</p>', title: 'A' }]
			}),
			'x.epub'
		);
		expect(book.chapters[0].blocks).toEqual([{ type: 'text', text: 'Hard wrapped source.' }]);
	});

	describe('where the story starts', () => {
		const front = [
			{ file: 'text/praise.xhtml', body: '<p>\u201cAstonishing.\u201d</p>', title: 'Praise' },
			{ file: 'text/copyright.xhtml', body: '<p>Copyright 1965.</p>', title: 'Copyright' },
			{ file: 'text/note.xhtml', body: '<p>A word before we begin.</p>', title: 'A Note' },
			{ file: 'text/one.xhtml', body: '<h1>Book One</h1><p>It began.</p>', title: 'Book One' }
		];

		it('follows an EPUB 2 guide entry, even past a chapter with an ordinary title', () => {
			const book = parseEpub(
				buildEpub({ version: 2, chapters: front, textStart: 'text/one.xhtml' }),
				'b.epub'
			);
			expect(book.chapters[book.startChapter].title).toBe('Book One');
		});

		it('follows an EPUB 3 bodymatter landmark', () => {
			const book = parseEpub(
				buildEpub({ chapters: front, textStart: 'text/one.xhtml#x' }),
				'b.epub'
			);
			expect(book.chapters[book.startChapter].title).toBe('Book One');
		});

		it('without either, skips front matter by its titles only', () => {
			const book = parseEpub(buildEpub({ chapters: front }), 'b.epub');
			expect(book.chapters[book.startChapter].title).toBe('A Note');
		});

		it('opens an AO3 download at its first chapter and drops AO3\u2019s own lines', () => {
			// Shaped like a Calibre-converted AO3 download: no guide, AO3 wording only.
			const book = parseEpub(
				buildEpub({
					version: 2,
					chapters: [
						{
							file: 'p.xhtml',
							title: 'Preface',
							body: '<h1>Preface</h1><p>A Work</p><p>Posted originally on the Archive of Our Own at http://archiveofourown.org/works/1.</p><p>Rating:</p><p>General Audiences</p>'
						},
						{
							file: 'c1.xhtml',
							title: '5 things',
							body: '<h1>5 things</h1><p>Chapter Notes</p><p>Thanks for reading!</p><p>(See the end of the chapter for more notes.)</p><p>It began.</p>'
						},
						{
							file: 'a.xhtml',
							title: 'Afterword',
							body: '<h1>Afterword</h1><p>End Notes</p><p>Fixed a typo.</p><p>Please drop by the Archive and comment to let the creator know if you enjoyed their work!</p>'
						}
					]
				}),
				'ao3.epub'
			);
			expect(book.startChapter).toBe(1);
			const lines = book.chapters.flatMap((c) =>
				c.blocks.flatMap((b) => (b.type === 'break' ? [] : [b.text]))
			);
			expect(lines).toContain('Thanks for reading!');
			expect(lines).toContain('Fixed a typo.');
			expect(lines.some((t) => /See the end|Please drop by/.test(t))).toBe(false);
		});
	});

	it('rejects archives that are not EPUBs or are damaged', () => {
		expect(() => parseEpub(zipSync({ 'a.txt': strToU8('hi') }), 'a.epub')).toThrow(ImportError);
		const broken = buildEpub().slice(0, 200);
		expect(() => parseEpub(broken, 'a.epub')).toThrow(ImportError);
	});
});

describe('readZip limits', () => {
	it('stops a zip bomb while inflating', () => {
		const bomb = zipSync({ 'big.xhtml': new Uint8Array(4 * 1024 * 1024) });
		expect(bomb.length).toBeLessThan(64 * 1024);
		expect(() =>
			readZip(bomb, () => true, { maxEntries: 10, maxEntryBytes: 1024 * 1024, maxTotalBytes: 2e6 })
		).toThrow(ZipLimitError);
	});

	it('counts real bytes, not the sizes the headers claim', () => {
		const archive = zipSync({ 'a.xhtml': new Uint8Array(200_000) });
		// Lie in both size headers: claim the file is 10 bytes.
		const view = new DataView(archive.buffer);
		view.setUint32(22, 10, true);
		const central = archive.findLastIndex(
			(_, i) => i + 4 <= archive.length && view.getUint32(i, true) === 0x02014b50
		);
		if (central >= 0) view.setUint32(central + 24, 10, true);
		expect(() =>
			readZip(archive, () => true, { maxEntries: 10, maxEntryBytes: 1000, maxTotalBytes: 1000 })
		).toThrow(ZipLimitError);
	});

	it('limits the number of entries', () => {
		const many: Zippable = {};
		for (let i = 0; i < 20; i++) many[`f${i}.xhtml`] = strToU8('x');
		expect(() =>
			readZip(zipSync(many), () => true, { maxEntries: 5, maxEntryBytes: 100, maxTotalBytes: 1000 })
		).toThrow(ZipLimitError);
	});
});

describe('text import', () => {
	it('decodes UTF-8, UTF-16 and falls back to Windows-1252', () => {
		expect(decodeText(strToU8('caf\u00E9'))).toBe('caf\u00E9');
		expect(decodeText(new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]))).toBe('hi');
		expect(decodeText(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toBe('caf\u00E9');
		expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]))).toBe('hi');
	});

	it('strips Project Gutenberg boilerplate and keeps title and author', () => {
		const text = [
			'The Project Gutenberg eBook of Example',
			'Title: Example Tale',
			'Author: Jane Doe',
			'*** START OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***',
			'Story text.',
			'*** END OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***',
			'License text.'
		].join('\n');
		const cleaned = stripGutenberg(text);
		expect(cleaned.title).toBe('Example Tale');
		expect(cleaned.author).toBe('Jane Doe');
		expect(cleaned.text.trim()).toBe('Story text.');
	});

	it('removes underscore emphasis markers but keeps other underscores', () => {
		expect(stripUnderscoreEmphasis("I'm sure _I_ shan't. (_very_ odd)")).toBe(
			"I'm sure I shan't. (very odd)"
		);
		expect(stripUnderscoreEmphasis('_Two words_, said she.')).toBe('Two words, said she.');
		expect(stripUnderscoreEmphasis('snake_case_name and __init__')).toBe(
			'snake_case_name and __init__'
		);
	});

	it('detects the format from content, not the file name', () => {
		expect(importFile(buildEpub(), 'renamed.txt').source).toBe('epub');
		expect(importFile(strToU8('Hello there.'), 'book.epub').source).toBe('txt');
		expect(() => importFile(new Uint8Array([0, 1, 2, 3, 0, 0]), 'x.txt')).toThrow(ImportError);
		expect(() => importFile(new Uint8Array(), 'x.txt')).toThrow(ImportError);
	});

	it('names pasted text sensibly', () => {
		expect(parsePaste('A short first line.\n\nMore.', null).title).toBe('A short first line.');
		expect(parsePaste('Body.', 'Given').title).toBe('Given');
	});
});

describe('sniffImage', () => {
	it('recognises images by their bytes only', () => {
		expect(sniffImage(PNG)).toBe('image/png');
		expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
		expect(sniffImage(strToU8('<svg onload=alert(1)>'))).toBeNull();
	});
});
