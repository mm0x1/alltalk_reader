/** Moving through a book: a place is a chapter and one of its passages (see passages.ts). */

import type { ChapterContent } from '#lib/library.js';

export interface Position {
	chapter: number;
	passage: number;
}

/** The next passage in the same chapter, or null at the chapter's end. */
export function nextInChapter(chapter: ChapterContent, position: Position): Position | null {
	return position.passage + 1 < chapter.passages.length
		? { chapter: position.chapter, passage: position.passage + 1 }
		: null;
}

/** The passage before, or null at the chapter's start. */
export function previousInChapter(position: Position): Position | null {
	return position.passage > 0 ? { chapter: position.chapter, passage: position.passage - 1 } : null;
}

/** Every passage of a chapter, in reading order. */
export function chapterPositions(chapter: ChapterContent): Position[] {
	return chapter.passages.map((_, passage) => ({ chapter: chapter.position, passage }));
}
