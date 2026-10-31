/** Turns an uploaded file into a book, deciding the format from its content. */

import type { ParsedBook } from '#lib/book.js';
import { parseEpub } from './epub';
import { ImportError } from './errors';
import { isZip, looksBinary } from './sniff';
import { parsePaste, parseTxt } from './txt';

export { ImportError } from './errors';

const MAX_CHAPTERS = 5_000;
const MAX_BLOCKS = 500_000;

function checkSize(book: ParsedBook): ParsedBook {
	const blocks = book.chapters.reduce((sum, c) => sum + c.blocks.length, 0);
	if (book.chapters.length > MAX_CHAPTERS || blocks > MAX_BLOCKS) {
		throw new ImportError('This book is too long to import.');
	}
	return book;
}

export function importFile(bytes: Uint8Array, filename: string): ParsedBook {
	if (bytes.length === 0) throw new ImportError('The file is empty.');
	if (isZip(bytes)) return checkSize(parseEpub(bytes, filename));
	if (looksBinary(bytes)) {
		throw new ImportError('Readhouse can open EPUB and plain text (.txt) files.');
	}
	return checkSize(parseTxt(bytes, filename));
}

export function importPaste(text: string, title: string | null): ParsedBook {
	return checkSize(parsePaste(text, title));
}
