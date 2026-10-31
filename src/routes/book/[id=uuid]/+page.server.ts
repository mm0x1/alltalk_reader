import { error } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { firstSpoken } from '#lib/reader/position.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const { library, config } = app();
	const book = library.get(params.id);
	if (!book) error(404, 'This book is not in your library.');
	library.markOpened(book.id);

	const saved = book.progress;
	const chapterIndex = saved && saved.chapter < book.chapterCount ? saved.chapter : 0;
	const chapter = library.chapter(book.id, chapterIndex)!;
	const block =
		saved && saved.chapter === chapterIndex && saved.block < chapter.blocks.length
			? saved.block
			: (firstSpoken(chapter.blocks) ?? 0);

	return {
		book,
		chapter,
		start: { chapter: chapterIndex, block, segment: 0 },
		segmentMaxChars: config.segmentMaxChars
	};
};
