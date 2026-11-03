/**
 * How far through the book the place is, by words, and whether this device shows it at all
 * (localStorage; some readers would rather not know). Words count, not sections: a book's
 * sections include praise, copyright and part-title pages, so "Ch. 7 of 64" could sit on a
 * page titled Chapter 1.
 */

import type { ChapterSummary } from '#lib/library.js';

export const SHOW_PROGRESS_KEY = 'readhouse:show-progress';

/**
 * Whole percent read when `passage` of `passageCount` in chapter `chapter` starts: the words of
 * every chapter before it, plus that share of its own. Never 100 until the last passage.
 */
export function bookProgress(
	chapters: readonly ChapterSummary[],
	chapter: number,
	passage: number,
	passageCount: number
): number {
	const total = chapters.reduce((sum, c) => sum + c.wordCount, 0);
	if (total === 0) return 0;
	const before = chapters.slice(0, chapter).reduce((sum, c) => sum + c.wordCount, 0);
	const within = passageCount > 0 ? passage / passageCount : 0;
	const read = before + within * (chapters[chapter]?.wordCount ?? 0);
	const last = chapter === chapters.length - 1 && passage === passageCount - 1;
	return last ? 100 : Math.min(99, Math.floor((read / total) * 100));
}

export function readShowProgress(): boolean {
	try {
		return localStorage.getItem(SHOW_PROGRESS_KEY) !== 'off';
	} catch {
		return true;
	}
}

export function writeShowProgress(show: boolean): void {
	try {
		if (show) localStorage.removeItem(SHOW_PROGRESS_KEY);
		else localStorage.setItem(SHOW_PROGRESS_KEY, 'off');
	} catch {
		// Not remembered in private mode; it shows again next time.
	}
}
