import { describe, expect, it } from 'vitest';
import type { Block } from '#lib/book.js';
import { dropCapBlock } from './drop-cap';

const long = (start: string) => ({ type: 'text' as const, text: start + ' and so on.'.repeat(10) });

describe('dropCapBlock', () => {
	it('opens the first paragraph, past headings and breaks', () => {
		const blocks: Block[] = [{ type: 'heading', text: 'One' }, { type: 'break' }, long('It was')];
		expect(dropCapBlock(blocks)).toBe(2);
	});

	it('opens a short but real first paragraph', () => {
		const carol = 'Marley was dead: to begin with. There is no doubt whatever about that.';
		expect(dropCapBlock([{ type: 'text', text: carol }])).toBe(0);
	});

	it('allows opening quotes before the letter', () => {
		expect(dropCapBlock([long('\u201cMy dear')])).toBe(0);
		expect(dropCapBlock([long('"Well')])).toBe(0);
	});

	it('skips a short opening line, a digit, a dash or an ellipsis', () => {
		expect(dropCapBlock([{ type: 'text', text: '1. At a meeting' }, long('Batman')])).toBe(1);
		expect(dropCapBlock([long('1999 was'), long('Then')])).toBe(1);
		expect(dropCapBlock([long('\u201c-And that'), long('Does')])).toBe(1);
		expect(dropCapBlock([long('\u2026and then'), long('Later')])).toBe(1);
	});

	it('gives up after the first few paragraphs', () => {
		const short = { type: 'text' as const, text: '\u201cHi.\u201d' };
		expect(dropCapBlock([short, short, short, long('Late')])).toBe(-1);
		expect(dropCapBlock([{ type: 'heading', text: 'Only a title' }])).toBe(-1);
	});
});
