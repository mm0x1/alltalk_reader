import { error } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { passageForBlock } from '#lib/text/passages.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const { library, settings, preparer } = app();
	const book = library.get(params.id);
	if (!book) error(404, 'This book is not in your library.');
	library.markOpened(book.id);

	// A prepared book keeps the passage length it was prepared with.
	const passageChars = (preparer.voice(book.id)?.settings ?? settings.voice()).passageChars;
	const saved = book.progress;
	const chapterIndex =
		saved && saved.chapter < book.chapterCount ? saved.chapter : book.startChapter;
	const chapter = library.chapter(book.id, chapterIndex, passageChars)!;
	// The place is saved as a paragraph, so it survives a change of passage length.
	const passage =
		saved && saved.chapter === chapterIndex
			? (passageForBlock(chapter.passages, saved.block) ?? 0)
			: 0;

	return { book, chapter, start: { chapter: chapterIndex, passage }, passageChars };
};
