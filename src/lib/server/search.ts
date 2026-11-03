/**
 * Finding a passage in a book: the reader's words become one FTS5 phrase, and each hit comes
 * back as plain-text parts with the matched words flagged, so nothing is ever marked up as HTML.
 */

import type { SearchPart } from '#lib/library.js';

/** Words of a query; more than this and the phrase would never match anyway. */
const MAX_WORDS = 16;
/** A shorter unfinished word would match most of the book ("a*"), so it must be whole. */
const MIN_PREFIX_CHARS = 3;
const WORD = /[\p{L}\p{N}]+/gu;

/** The markers `snippet()` puts around a match; control characters never survive import. */
export const MATCH_START = '\u0002';
export const MATCH_END = '\u0003';

/**
 * The query as an FTS5 phrase whose last word may be unfinished (`"have you hea"*`), or null
 * when it has no words. Only letters and digits get through, so the reader's text can't use
 * FTS5's own syntax (NEAR, OR, column filters, quotes).
 */
export function searchPhrase(query: string): string | null {
	const words = query.match(WORD)?.slice(0, MAX_WORDS);
	if (!words) return null;
	const prefix = [...words.at(-1)!].length >= MIN_PREFIX_CHARS ? '*' : '';
	return `"${words.join(' ')}"${prefix}`;
}

/** Splits a snippet on its markers into plain-text parts. */
export function snippetParts(snippet: string): SearchPart[] {
	const parts: SearchPart[] = [];
	let match = false;
	// eslint-disable-next-line no-control-regex
	for (const piece of snippet.split(/([\u0002\u0003])/)) {
		if (piece === MATCH_START) match = true;
		else if (piece === MATCH_END) match = false;
		else if (piece) {
			const last = parts.at(-1);
			if (last && last.match === match) last.text += piece;
			else parts.push({ text: piece, match });
		}
	}
	return parts;
}
