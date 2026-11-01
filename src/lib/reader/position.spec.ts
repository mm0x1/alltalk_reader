import { describe, expect, it } from 'vitest';
import type { Block } from '#lib/book.js';
import type { ChapterContent } from '#lib/library.js';
import { buildPassages } from '#lib/text/passages.js';
import { chapterPositions, nextInChapter, previousInChapter } from './position.js';

const blocks: Block[] = [
	{ type: 'heading', text: 'Chapter 1' },
	{ type: 'text', text: 'A sentence that goes on for a while. '.repeat(5).trim() },
	{ type: 'break' },
	{ type: 'text', text: 'Short.' }
];
const chapter: ChapterContent = {
	position: 2,
	title: 'Chapter 1',
	blocks,
	passages: buildPassages(blocks, 80),
	passageChars: 80
};

describe('reading positions', () => {
	it('lists every passage of a chapter in order', () => {
		const positions = chapterPositions(chapter);
		expect(positions.length).toBe(chapter.passages.length);
		expect(positions[0]).toEqual({ chapter: 2, passage: 0 });
	});

	it('moves within a chapter and stops at its ends', () => {
		const last = chapter.passages.length - 1;
		expect(nextInChapter(chapter, { chapter: 2, passage: 0 })).toEqual({ chapter: 2, passage: 1 });
		expect(nextInChapter(chapter, { chapter: 2, passage: last })).toBeNull();
		expect(previousInChapter({ chapter: 2, passage: 1 })).toEqual({ chapter: 2, passage: 0 });
		expect(previousInChapter({ chapter: 2, passage: 0 })).toBeNull();
	});
});
