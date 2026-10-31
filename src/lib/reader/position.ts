/** Moving through a book: chapter, block and segment, skipping blocks that aren't spoken. */

import { isSpoken, type Block } from '#lib/book.js';
import { splitIntoSegments } from '#lib/text/segments.js';

export interface Position {
	chapter: number;
	block: number;
	segment: number;
}

export function segmentCount(block: Block | undefined, maxChars: number): number {
	if (!block || block.type === 'break') return 0;
	return splitIntoSegments(block.text, maxChars).length;
}

/** The first spoken block at or after `from`, or null when there is none. */
export function firstSpoken(blocks: readonly Block[], from = 0): number | null {
	for (let i = Math.max(0, from); i < blocks.length; i++) {
		if (isSpoken(blocks[i])) return i;
	}
	return null;
}

/** The last spoken block before `before`, or null. */
export function lastSpokenBefore(blocks: readonly Block[], before: number): number | null {
	for (let i = Math.min(before, blocks.length) - 1; i >= 0; i--) {
		if (isSpoken(blocks[i])) return i;
	}
	return null;
}

/** The next segment to play within the same chapter, or null at the chapter's end. */
export function nextInChapter(
	blocks: readonly Block[],
	position: Position,
	maxChars: number
): Position | null {
	if (position.segment + 1 < segmentCount(blocks[position.block], maxChars)) {
		return { ...position, segment: position.segment + 1 };
	}
	const block = firstSpoken(blocks, position.block + 1);
	return block === null ? null : { chapter: position.chapter, block, segment: 0 };
}

/** Every segment of a chapter, in reading order. */
export function chapterPositions(
	chapter: number,
	blocks: readonly Block[],
	maxChars: number
): Position[] {
	const positions: Position[] = [];
	blocks.forEach((block, index) => {
		const count = segmentCount(block, maxChars);
		for (let segment = 0; segment < count; segment++) {
			positions.push({ chapter, block: index, segment });
		}
	});
	return positions;
}

/** Where "back" goes: the start of this block if we are past its start, else the block before. */
export function previousInChapter(blocks: readonly Block[], position: Position): Position | null {
	if (position.segment > 0) return { ...position, segment: 0 };
	const block = lastSpokenBefore(blocks, position.block);
	return block === null ? null : { chapter: position.chapter, block, segment: 0 };
}
