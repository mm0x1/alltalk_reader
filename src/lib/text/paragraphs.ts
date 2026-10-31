/** Turns plain text (TXT files, pasted text) into blocks: paragraphs and scene breaks. */

import type { Block } from '#lib/book.js';
import { collapseWhitespace, normalizeText } from './normalize';
import { splitIntoSegments } from './segments';

const SCENE_BREAK = /^\s*(?:(?:[-*_~=#\u2022\u00B7+]\s*){3,}|\u2042|\u2766|\u00A7|\*)\s*$/;

/** Paragraphs longer than this are split for readable highlighting while listening. */
const MAX_PARAGRAPH_CHARS = 1500;

export function isSceneBreak(line: string): boolean {
	return SCENE_BREAK.test(line);
}

type Strategy = 'blank-lines' | 'indentation' | 'lines';

function chooseStrategy(lines: readonly string[]): Strategy {
	let nonBlank = 0;
	let blankSeparators = 0;
	let indented = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') {
			if (i > 0 && lines[i - 1].trim() !== '') blankSeparators++;
			continue;
		}
		nonBlank++;
		if (/^[ \t]+\S/.test(line)) indented++;
	}
	if (blankSeparators >= Math.max(1, nonBlank * 0.05)) return 'blank-lines';
	if (indented >= nonBlank * 0.08 && indented > 1) return 'indentation';
	return 'lines';
}

/** Groups lines into raw paragraphs according to the strategy. Scene breaks stand alone. */
function groupLines(lines: readonly string[], strategy: Strategy): string[][] {
	const groups: string[][] = [];
	let current: string[] = [];
	const flush = () => {
		if (current.length > 0) groups.push(current);
		current = [];
	};
	for (const line of lines) {
		if (line.trim() === '') {
			if (strategy !== 'indentation') flush();
			continue;
		}
		if (isSceneBreak(line)) {
			flush();
			groups.push([line]);
			continue;
		}
		if (strategy === 'lines' || (strategy === 'indentation' && /^[ \t]+\S/.test(line))) flush();
		current.push(line);
	}
	flush();
	return groups;
}

/**
 * Appends a block, splitting very long paragraphs and keeping breaks tidy: never at the start
 * and never two in a row. Call `finishBlocks` when done to drop a trailing break.
 */
export function appendBlock(blocks: Block[], block: Block): void {
	if (block.type === 'break') {
		if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'break') blocks.push(block);
		return;
	}
	if (block.type === 'text' && block.text.length > MAX_PARAGRAPH_CHARS) {
		for (const piece of splitIntoSegments(block.text, MAX_PARAGRAPH_CHARS)) {
			blocks.push({ type: 'text', text: piece });
		}
		return;
	}
	blocks.push(block);
}

export function finishBlocks(blocks: Block[]): Block[] {
	while (blocks.length > 0 && blocks[blocks.length - 1].type === 'break') blocks.pop();
	return blocks;
}

export function textToBlocks(text: string): Block[] {
	const lines = normalizeText(text).split('\n');
	const blocks: Block[] = [];
	for (const group of groupLines(lines, chooseStrategy(lines))) {
		if (group.length === 1 && isSceneBreak(group[0])) {
			appendBlock(blocks, { type: 'break' });
			continue;
		}
		const paragraph = collapseWhitespace(group.join(' '));
		if (paragraph) appendBlock(blocks, { type: 'text', text: paragraph });
	}
	return finishBlocks(blocks);
}
