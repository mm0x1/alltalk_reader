import { describe, expect, it } from 'vitest';
import type { Block } from '#lib/book.js';
import { buildPassages, passageForBlock, passageText } from './passages';

const text = (t: string): Block => ({ type: 'text', text: t });
const texts = (blocks: Block[], max: number) =>
	buildPassages(blocks, max).map((passage) => passageText(blocks, passage));

describe('buildPassages', () => {
	it('joins a run of short dialogue lines into one passage', () => {
		const blocks = [
			text('“You came back.”'),
			text('“I said I would.”'),
			text('“You say a lot of things.”'),
			text('She laughed. “Fair.”')
		];
		expect(texts(blocks, 200)).toEqual([
			'“You came back.” “I said I would.” “You say a lot of things.” She laughed. “Fair.”'
		]);
	});

	it('cuts a wall of text at sentence ends, never past the limit', () => {
		const sentence = 'The rain kept on through the night and into the grey morning. ';
		const blocks = [text(sentence.repeat(20))];
		const passages = texts(blocks, 125);
		expect(passages.length).toBeGreaterThan(5);
		for (const passage of passages) {
			expect(passage.length).toBeLessThanOrEqual(125);
			expect(passage.endsWith('.')).toBe(true);
		}
		expect(passages.join(' ')).toBe(sentence.repeat(20).trim());
	});

	it('cuts one very long sentence at clauses, then at spaces', () => {
		const long = Array.from({ length: 12 }, (_, i) => `the ${i}th clause runs on a while`).join(
			', '
		);
		const passages = texts([text(`${long}.`)], 80);
		for (const passage of passages) expect(passage.length).toBeLessThanOrEqual(80);
		expect(passages.join(' ')).toBe(`${long}.`);
	});

	it('prefers a paragraph end once a passage is half full', () => {
		const a = 'A first paragraph that is about seventy characters long, give or take.';
		const b = 'A second one.';
		// `a` fills more than half of 120, so the paragraph end breaks before `b`.
		expect(texts([text(a), text(b)], 120)).toEqual([a, b]);
		// With room to spare and `a` under half, they join.
		expect(texts([text('Short.'), text(b)], 120)).toEqual(['Short. A second one.']);
	});

	it('always breaks at headings and scene breaks', () => {
		const blocks: Block[] = [
			{ type: 'heading', text: 'Chapter 1' },
			text('One.'),
			{ type: 'break' },
			text('Two.')
		];
		expect(texts(blocks, 500)).toEqual(['Chapter 1', 'One.', 'Two.']);
	});

	it('keeps offsets into the paragraph, so verse keeps its lines on screen', () => {
		const verse = 'The sea is calm tonight.\nThe tide is full, the moon lies fair';
		const [passage] = buildPassages([text(verse)], 200);
		expect(passage.pieces).toEqual([{ block: 0, start: 0, end: verse.length }]);
		expect(passageText([text(verse)], passage)).toBe(
			'The sea is calm tonight. The tide is full, the moon lies fair'
		);
	});

	it('finds the passage that reads a paragraph', () => {
		const blocks = [text('Short.'), text('Also short.'), text('x '.repeat(80))];
		const passages = buildPassages(blocks, 100);
		expect(passageForBlock(passages, 1)).toBe(0);
		expect(passageForBlock(passages, 2)).toBe(1);
		expect(passageForBlock(passages, 9)).toBeNull();
	});

	it('rejects a limit below the minimum', () => {
		expect(() => buildPassages([text('Hi.')], 10)).toThrow(RangeError);
	});
});
