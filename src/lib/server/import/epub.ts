/**
 * EPUB 2 and 3 import: metadata, spine order, chapter titles from the table of contents
 * (EPUB 3 nav or EPUB 2 NCX), text and cover. Everything happens in memory; archive paths are
 * only ever used as map keys, never as file system paths.
 */

import { DomUtils, parseDocument } from 'htmlparser2';
import type { Block, ParsedBook, ParsedChapter } from '#lib/book.js';
import { cleanChapterTitle } from '#lib/text/chapters.js';
import { collapseWhitespace } from '#lib/text/normalize.js';
import { appendBlock, finishBlocks } from '#lib/text/paragraphs.js';
import { htmlToBlocks } from './html';
import { sniffImage } from './sniff';
import { ImportError } from './errors';
import { readZip, ZipLimitError } from './zip';

type Node = ReturnType<typeof parseDocument>;
type Element = ReturnType<typeof DomUtils.findAll>[number];

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const TEXT_ENTRY = /\.(?:xml|opf|ncx|xhtml|html|htm)$/i;
const DOCUMENT_TYPES = new Set(['application/xhtml+xml', 'text/html']);

interface ManifestItem {
	path: string;
	mediaType: string;
	properties: string[];
}

function localName(name: string): string {
	const colon = name.lastIndexOf(':');
	return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

function elements(root: Node | Element, name: string): Element[] {
	return DomUtils.findAll((el) => localName(el.name) === name, [root]);
}

function attribute(el: Element, name: string): string | undefined {
	for (const [key, value] of Object.entries(el.attribs)) {
		if (localName(key) === name) return value;
	}
	return undefined;
}

function text(el: Element): string {
	return collapseWhitespace(DomUtils.textContent(el));
}

/** Resolves an href against the directory of `from`, dropping any #fragment. */
export function resolvePath(from: string, href: string): string | null {
	try {
		const base = new URL(from, 'epub://book/');
		const url = new URL(href, base);
		if (url.protocol !== 'epub:' || url.host !== 'book') return null;
		return decodeURIComponent(url.pathname.slice(1));
	} catch {
		return null;
	}
}

const decoder = new TextDecoder('utf-8');

function parseXml(bytes: Uint8Array | undefined): Node | null {
	return bytes ? parseDocument(decoder.decode(bytes), { xmlMode: true }) : null;
}

function findOpfPath(entries: Map<string, Uint8Array>): string {
	const container = parseXml(entries.get('META-INF/container.xml'));
	const rootfile = container && elements(container, 'rootfile')[0];
	const path = rootfile && attribute(rootfile, 'full-path');
	if (path && entries.has(path)) return path;
	const fallback = [...entries.keys()].find((name) => name.toLowerCase().endsWith('.opf'));
	if (!fallback) throw new ImportError('This EPUB has no package file (OPF).');
	return fallback;
}

interface TocEntry {
	fragment: string | null;
	title: string;
}

/** Table-of-contents entries grouped by document path, in reading order. */
function tableOfContents(
	entries: Map<string, Uint8Array>,
	manifest: Map<string, ManifestItem>,
	ncxId: string | undefined
): Map<string, TocEntry[]> {
	const toc = new Map<string, TocEntry[]>();
	const add = (from: string, href: string | undefined, label: string) => {
		if (!href || !label) return;
		const path = resolvePath(from, href);
		if (!path) return;
		const hash = href.indexOf('#');
		const fragment = hash === -1 ? null : decodeURIComponent(href.slice(hash + 1)) || null;
		const list = toc.get(path) ?? [];
		if (!list.some((entry) => entry.fragment === fragment)) {
			list.push({ fragment, title: cleanChapterTitle(label) });
		}
		toc.set(path, list);
	};

	const nav = [...manifest.values()].find((item) => item.properties.includes('nav'));
	const navDoc = nav && parseXml(entries.get(nav.path));
	if (nav && navDoc) {
		const navs = elements(navDoc, 'nav');
		const tocNav =
			navs.find((el) => attribute(el, 'type')?.split(/\s+/).includes('toc')) ?? navs[0];
		if (tocNav) for (const a of elements(tocNav, 'a')) add(nav.path, attribute(a, 'href'), text(a));
	}
	if (toc.size > 0) return toc;

	const ncx =
		(ncxId && manifest.get(ncxId)) ||
		[...manifest.values()].find((item) => item.mediaType === 'application/x-dtbncx+xml');
	const ncxDoc = ncx && parseXml(entries.get(ncx.path));
	if (ncx && ncxDoc) {
		for (const point of elements(ncxDoc, 'navpoint')) {
			const label = elements(point, 'navlabel')[0];
			const content = elements(point, 'content')[0];
			if (label && content) add(ncx.path, attribute(content, 'src'), text(label));
		}
	}
	return toc;
}

const GUTENBERG_START = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG/i;
const GUTENBERG_END = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i;

/** Drops the Project Gutenberg header and licence that Gutenberg EPUBs carry as text. */
function stripGutenberg(chapters: ParsedChapter[]): ParsedChapter[] {
	const isMarker = (pattern: RegExp) => (block: Block) =>
		block.type !== 'break' && pattern.test(block.text);
	const startChapter = chapters.findIndex((c) => c.blocks.some(isMarker(GUTENBERG_START)));
	const endChapter = chapters.findIndex((c) => c.blocks.some(isMarker(GUTENBERG_END)));
	if (startChapter === -1 && endChapter === -1) return chapters;

	return chapters
		.map((chapter, index) => {
			let blocks = chapter.blocks;
			if (index < startChapter || (endChapter !== -1 && index > endChapter)) return null;
			if (index === startChapter) {
				blocks = blocks.slice(blocks.findIndex(isMarker(GUTENBERG_START)) + 1);
			}
			if (index === endChapter) blocks = blocks.slice(0, blocks.findIndex(isMarker(GUTENBERG_END)));
			blocks = finishBlocks(blocks.slice());
			while (blocks[0]?.type === 'break') blocks.shift();
			return blocks.length > 0 ? { ...chapter, blocks } : null;
		})
		.filter((chapter): chapter is ParsedChapter => chapter !== null);
}

function findCoverPath(opf: Node, manifest: Map<string, ManifestItem>): string | null {
	const byProperty = [...manifest.values()].find((item) => item.properties.includes('cover-image'));
	if (byProperty) return byProperty.path;
	const meta = elements(opf, 'meta').find((el) => attribute(el, 'name') === 'cover');
	const id = meta && attribute(meta, 'content');
	const byMeta = id ? manifest.get(id) : undefined;
	if (byMeta?.mediaType.startsWith('image/')) return byMeta.path;
	return null;
}

export function parseEpub(bytes: Uint8Array, filename: string): ParsedBook {
	let entries: Map<string, Uint8Array>;
	try {
		entries = readZip(bytes, (name) => TEXT_ENTRY.test(name));
	} catch (error) {
		if (error instanceof ZipLimitError) throw new ImportError(error.message);
		throw new ImportError('This EPUB is damaged and could not be opened.');
	}

	const opfPath = findOpfPath(entries);
	const opf = parseXml(entries.get(opfPath));
	if (!opf) throw new ImportError('This EPUB has no package file (OPF).');

	const manifest = new Map<string, ManifestItem>();
	for (const item of elements(opf, 'item')) {
		const id = attribute(item, 'id');
		const path = resolvePath(opfPath, attribute(item, 'href') ?? '');
		if (!id || !path) continue;
		manifest.set(id, {
			path,
			mediaType: (attribute(item, 'media-type') ?? '').toLowerCase(),
			properties: (attribute(item, 'properties') ?? '').split(/\s+/).filter(Boolean)
		});
	}

	const spineElement = elements(opf, 'spine')[0];
	const spine = elements(opf, 'itemref')
		.filter((ref) => attribute(ref, 'linear') !== 'no')
		.map((ref) => manifest.get(attribute(ref, 'idref') ?? ''))
		.filter((item): item is ManifestItem => !!item && DOCUMENT_TYPES.has(item.mediaType));
	if (spine.length === 0) throw new ImportError('This EPUB has no readable chapters.');

	const toc = tableOfContents(entries, manifest, spineElement && attribute(spineElement, 'toc'));
	let chapters: ParsedChapter[] = [];
	let current: ParsedChapter | null = null;
	// An empty section (often a part-title image) can still name the chapter that follows.
	let pendingTitle: string | null = null;

	const addSection = (blocks: Block[], tocTitle: string | null) => {
		if (blocks.length === 0) {
			pendingTitle = tocTitle ?? pendingTitle;
			return;
		}
		const title = tocTitle ?? pendingTitle;
		pendingTitle = null;
		if (current && !title && toc.size > 0) {
			// Continues the previous chapter, split across files by the publishing tool.
			for (const block of blocks) appendBlock(current.blocks, block);
			return;
		}
		const heading = blocks.find((block) => block.type === 'heading');
		current = {
			title:
				title ?? (heading ? cleanChapterTitle(heading.text) : `Section ${chapters.length + 1}`),
			blocks: [...blocks]
		};
		chapters.push(current);
	};

	for (const item of spine) {
		const source = entries.get(item.path);
		if (!source) continue;
		const tocEntries = toc.get(item.path) ?? [];
		const fragments = new Set(tocEntries.flatMap((e) => (e.fragment ? [e.fragment] : [])));
		const { blocks, anchors } = htmlToBlocks(decoder.decode(source), fragments);

		// Where each table-of-contents entry starts within this document. A link to an anchor
		// the document doesn't have points at its start.
		const cuts = tocEntries
			.map((entry) => ({
				at: entry.fragment === null ? 0 : (anchors.get(entry.fragment) ?? 0),
				title: entry.title
			}))
			.sort((a, b) => a.at - b.at)
			.filter((cut, i, all) => i === 0 || cut.at !== all[i - 1].at);

		const firstCut = cuts[0]?.at ?? blocks.length;
		addSection(blocks.slice(0, firstCut), null);
		cuts.forEach((cut, i) => {
			addSection(blocks.slice(cut.at, cuts[i + 1]?.at ?? blocks.length), cut.title);
		});
	}
	chapters = stripGutenberg(chapters.map((c) => ({ ...c, blocks: finishBlocks(c.blocks) })));
	if (chapters.length === 0) throw new ImportError('This EPUB has no readable text.');

	const metadata = elements(opf, 'metadata')[0] ?? opf;
	const titleEl = elements(metadata, 'title')[0];
	const creators = elements(metadata, 'creator').map(text).filter(Boolean);
	const languageEl = elements(metadata, 'language')[0];

	let cover: ParsedBook['cover'] = null;
	const coverPath = findCoverPath(opf, manifest);
	if (coverPath) {
		try {
			const coverBytes = readZip(bytes, (name) => name === coverPath).get(coverPath);
			const mime = coverBytes && sniffImage(coverBytes);
			if (coverBytes && mime && coverBytes.length <= MAX_COVER_BYTES) {
				cover = { bytes: coverBytes, mime };
			}
		} catch {
			// A broken cover is not worth failing the import for.
		}
	}

	return {
		title: (titleEl && text(titleEl)) || filename.replace(/\.epub$/i, '') || 'Untitled',
		author: creators.length > 0 ? creators.join(', ') : null,
		language: (languageEl && text(languageEl)) || null,
		source: 'epub',
		chapters,
		cover
	};
}
