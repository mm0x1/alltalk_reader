/** Library types shared by the server and the reader. */

import type { Block, BookSource } from './book';
import type { Passage } from './text/passages';

export interface Progress {
	chapter: number;
	block: number;
	updatedAt: number;
}

export interface BookSummary {
	id: string;
	title: string;
	author: string | null;
	language: string | null;
	source: BookSource;
	chapterCount: number;
	/** Where the story starts, past front matter: where a new book opens. */
	startChapter: number;
	wordCount: number;
	createdAt: number;
	openedAt: number | null;
	hasCover: boolean;
	progress: Progress | null;
}

export interface ChapterSummary {
	title: string;
	wordCount: number;
}

export interface BookDetail extends BookSummary {
	chapters: ChapterSummary[];
}

export interface ChapterContent {
	position: number;
	title: string;
	blocks: Block[];
	/** What is read aloud, one request at a time, built for `passageChars`. */
	passages: Passage[];
	passageChars: number;
}

/** A book prepared in full: every passage made ahead with the settings of that moment. */
export interface Preparation {
	state: 'preparing' | 'paused' | 'ready';
	done: number;
	total: number;
	/** Why it is paused, in plain words. */
	message: string | null;
	/** What it was made with, shown in Contents. */
	voice: string;
	model: string | null;
	passageChars: number;
	finishedAt: number | null;
}
