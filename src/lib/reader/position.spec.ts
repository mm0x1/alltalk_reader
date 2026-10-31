import { describe, expect, it } from 'vitest';
import type { Block } from '#lib/book.js';
import {
	firstSpoken,
	lastSpokenBefore,
	nextInChapter,
	previousInChapter,
	segmentCount
} from './position.js';

const long = 'A sentence that goes on for a while. '.repeat(5).trim();
const blocks: Block[] = [
	{ type: 'heading', text: 'Chapter 1' },
	{ type: 'text', text: long },
	{ type: 'break' },
	{ type: 'text', text: 'Short.' }
];

describe('reading positions', () => {
	it('counts segments, with none for breaks', () => {
		expect(segmentCount(blocks[1], 80)).toBeGreaterThan(1);
		expect(segmentCount(blocks[2], 80)).toBe(0);
		expect(segmentCount(undefined, 80)).toBe(0);
	});

	it('finds spoken blocks around breaks', () => {
		expect(firstSpoken(blocks, 2)).toBe(3);
		expect(firstSpoken(blocks, 4)).toBeNull();
		expect(lastSpokenBefore(blocks, 3)).toBe(1);
		expect(lastSpokenBefore(blocks, 0)).toBeNull();
	});

	it('steps through segments, then blocks, skipping breaks, and stops at the end', () => {
		const segments = segmentCount(blocks[1], 80);
		let position = { chapter: 2, block: 1, segment: 0 };
		for (let i = 1; i < segments; i++) {
			position = nextInChapter(blocks, position, 80)!;
			expect(position).toEqual({ chapter: 2, block: 1, segment: i });
		}
		position = nextInChapter(blocks, position, 80)!;
		expect(position).toEqual({ chapter: 2, block: 3, segment: 0 });
		expect(nextInChapter(blocks, position, 80)).toBeNull();
	});

	it('goes back to the start of the block, then to the previous block', () => {
		expect(previousInChapter(blocks, { chapter: 0, block: 1, segment: 2 })).toEqual({
			chapter: 0,
			block: 1,
			segment: 0
		});
		expect(previousInChapter(blocks, { chapter: 0, block: 3, segment: 0 })).toEqual({
			chapter: 0,
			block: 1,
			segment: 0
		});
		expect(previousInChapter(blocks, { chapter: 0, block: 0, segment: 0 })).toBeNull();
	});
});
