/**
 * Where the story starts: a new book opens there instead of on its praise, copyright page or
 * printed contents. EPUBs that say where their text starts (guide or landmarks) are trusted
 * first; otherwise leading chapters are skipped while their titles are plainly front matter, or
 * while they are AO3's preface page. Skipped chapters stay in Contents.
 */

import type { ParsedChapter } from '#lib/book.js';
import { collapseWhitespace } from './normalize';
import { AO3_PREFACE } from './ao3';

const FRONT_MATTER = new RegExp(
	'^(?:' +
		[
			'cover',
			'title ?page',
			'half ?title',
			'copyright(?: page)?',
			'dedication',
			'(?:table of )?contents',
			'praise(?: for .+)?',
			'(?:also|other books|books) by .+',
			'by the same author',
			'about the publisher',
			'frontispiece'
		].join('|') +
		')$',
	'i'
);

function isFrontMatter(chapter: ParsedChapter): boolean {
	const title = collapseWhitespace(chapter.title).replace(/[.:]+$/, '');
	if (FRONT_MATTER.test(title)) return true;
	return chapter.blocks
		.slice(0, 6)
		.some((block) => block.type !== 'break' && AO3_PREFACE.test(block.text));
}

/** The first chapter of the story itself (never past the last chapter). */
export function storyStart(chapters: readonly ParsedChapter[]): number {
	let index = 0;
	while (index < chapters.length - 1 && isFrontMatter(chapters[index])) index++;
	return index;
}
