/** Which paragraph of a chapter opens with a drop cap. */

import type { Block } from '#lib/book.js';

/** Paragraphs looked at; deeper in, a drop cap no longer marks the opening. */
const LOOK_AHEAD = 3;
/** About two lines on a phone; anything shorter (a numbered line, a title) can't hold the cap. */
const MIN_CHARS = 60;
/** A letter first, after any opening quotes or brackets: never a digit, dash or ellipsis. */
const STARTS_WITH_LETTER = /^["'\u2018\u201c([]*\p{L}/u;

/** The index of the block that gets the drop cap, or -1 when none suits. */
export function dropCapBlock(blocks: readonly Block[]): number {
	let seen = 0;
	for (const [index, block] of blocks.entries()) {
		if (block.type !== 'text') continue;
		if (block.text.length >= MIN_CHARS && STARTS_WITH_LETTER.test(block.text)) return index;
		if (++seen === LOOK_AHEAD) break;
	}
	return -1;
}
