import type { BookSummary } from '#lib/library.js';

/** Where the reader is in a book, in words: "Chapter 3 of 12" or "12 chapters, not begun". */
export function placeInBook(book: BookSummary): string {
	if (book.progress) return `Chapter ${book.progress.chapter + 1} of ${book.chapterCount}`;
	const chapters = `${book.chapterCount} ${book.chapterCount === 1 ? 'chapter' : 'chapters'}`;
	return `${chapters}, not begun`;
}
