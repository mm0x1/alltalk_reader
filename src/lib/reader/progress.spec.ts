import { describe, expect, it } from 'vitest';
import { bookProgress } from './progress';

const chapters = (...words: number[]) =>
	words.map((wordCount, i) => ({ title: `${i}`, wordCount }));

describe('bookProgress', () => {
	it('counts words, so short front matter barely moves it', () => {
		const dune = chapters(300, 280, 215, 36, 55, 3, 4000, 4000, 91_111);
		expect(bookProgress(dune, 6, 0, 40)).toBe(0);
		expect(bookProgress(dune, 7, 0, 40)).toBe(4);
	});

	it('moves through a chapter passage by passage', () => {
		const two = chapters(1000, 1000);
		expect(bookProgress(two, 0, 0, 10)).toBe(0);
		expect(bookProgress(two, 0, 5, 10)).toBe(25);
		expect(bookProgress(two, 1, 0, 10)).toBe(50);
	});

	it('says 100 only at the last passage of the book', () => {
		const two = chapters(1000, 1000);
		expect(bookProgress(two, 1, 9, 10)).toBe(100);
		expect(bookProgress(chapters(10_000), 0, 998, 1000)).toBe(99);
	});

	it('copes with empty books and chapters not loaded yet', () => {
		expect(bookProgress(chapters(0, 0), 1, 0, 1)).toBe(0);
		expect(bookProgress(chapters(100, 100), 1, 0, 0)).toBe(50);
	});
});
