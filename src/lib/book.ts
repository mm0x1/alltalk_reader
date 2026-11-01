/**
 * The shape of a book, shared by the importers, the server and the reader.
 *
 * A book is a list of chapters; a chapter is a list of blocks. Text is stored as plain
 * text (never HTML), so nothing from an imported file is ever rendered as markup.
 */

export type Block =
	{ type: 'text'; text: string } | { type: 'heading'; text: string } | { type: 'break' };

/** Blocks that are read aloud. Scene breaks are shown but not spoken. */
export type SpokenBlock = Exclude<Block, { type: 'break' }>;

export const isSpoken = (block: Block): block is SpokenBlock => block.type !== 'break';

export const BOOK_SOURCES = ['epub', 'txt', 'paste'] as const;
export type BookSource = (typeof BOOK_SOURCES)[number];

export const COVER_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export type CoverMime = (typeof COVER_MIMES)[number];

export interface ParsedChapter {
	title: string;
	blocks: Block[];
}

export interface ParsedBook {
	title: string;
	author: string | null;
	language: string | null;
	source: BookSource;
	chapters: ParsedChapter[];
	/** Where the story starts (past front matter); a new book opens there. */
	startChapter: number;
	cover: { bytes: Uint8Array; mime: CoverMime } | null;
}

export function countWords(blocks: readonly Block[]): number {
	let words = 0;
	for (const block of blocks) {
		if (block.type === 'break') continue;
		const matches = block.text.match(/\S+/g);
		if (matches) words += matches.length;
	}
	return words;
}
