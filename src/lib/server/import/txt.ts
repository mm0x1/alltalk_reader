/** Plain text import: encoding detection, Project Gutenberg cleanup, chapters. */

import type { ParsedBook } from '#lib/book.js';
import { extractAo3 } from '#lib/text/ao3.js';
import { splitChapters } from '#lib/text/chapters.js';
import { storyStart } from '#lib/text/front-matter.js';
import { collapseWhitespace } from '#lib/text/normalize.js';
import { ImportError } from './errors';

/** Decodes text, honouring a BOM, preferring UTF-8 and falling back to Windows-1252. */
export function decodeText(bytes: Uint8Array): string {
	if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
		return new TextDecoder('utf-8').decode(bytes.subarray(3));
	}
	if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
	if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder('windows-1252').decode(bytes);
	}
}

const GUTENBERG_START = /^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG.*$/im;
const GUTENBERG_END = /^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG.*$/im;

interface Cleaned {
	text: string;
	title: string | null;
	author: string | null;
}

/** Removes the Project Gutenberg licence header and footer, keeping title and author. */
export function stripGutenberg(text: string): Cleaned {
	const start = GUTENBERG_START.exec(text);
	if (!start) return { text, title: null, author: null };
	const header = text.slice(0, start.index);
	const bodyStart = start.index + start[0].length;
	const end = GUTENBERG_END.exec(text.slice(bodyStart));
	const body = end ? text.slice(bodyStart, bodyStart + end.index) : text.slice(bodyStart);
	const field = (name: string) => {
		const match = new RegExp(`^${name}:\\s*(.+)$`, 'im').exec(header);
		return match ? collapseWhitespace(match[1]) : null;
	};
	return { text: body, title: field('Title'), author: field('Author') };
}

function titleFromFilename(filename: string): string {
	const stem = filename.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ');
	return collapseWhitespace(stem) || 'Untitled';
}

function build(
	text: string,
	title: string,
	author: string | null,
	source: 'txt' | 'paste'
): ParsedBook {
	const chapters = splitChapters(text, title);
	if (chapters.length === 0) throw new ImportError('There is no text to read in this file.');
	return {
		title,
		author,
		language: null,
		source,
		chapters,
		startChapter: storyStart(chapters),
		cover: null
	};
}

/**
 * Plain-text emphasis (`_word_`, the Project Gutenberg convention) loses its markers: they would
 * otherwise show on the page. Only underscores hugging a word at both ends are removed.
 */
export function stripUnderscoreEmphasis(text: string): string {
	return text.replace(
		/(^|[\s([{"'\u2018\u201C\u2014])_(?=\S)([^_\n]*?\S)_(?=$|[\s)\]}.,;:!?"'\u2019\u201D\u2014-])/gm,
		'$1$2'
	);
}

export function parseTxt(bytes: Uint8Array, filename: string): ParsedBook {
	const cleaned = stripGutenberg(decodeText(bytes));
	const title = cleaned.title ?? titleFromFilename(filename);
	return build(stripUnderscoreEmphasis(cleaned.text), title, cleaned.author, 'txt');
}

/** Pasted text. A copied AO3 page is recognised and reduced to the story. */
export function parsePaste(text: string, title: string | null): ParsedBook {
	const ao3 = extractAo3(text);
	const body = ao3?.text ?? text;
	const firstLine = collapseWhitespace(body.split('\n').find((l) => l.trim()) ?? '');
	const name =
		title?.trim() ||
		ao3?.title ||
		(firstLine.length <= 80 ? firstLine : firstLine.slice(0, 60) + '\u2026');
	return build(body, name || 'Pasted text', null, 'paste');
}
