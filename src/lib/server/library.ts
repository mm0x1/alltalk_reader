/** The library: books, chapters, covers and reading progress. */

import * as v from 'valibot';
import { countWords, type Block, type BookSource, type ParsedBook } from '#lib/book.js';
import type { BookSummary, BookDetail, ChapterContent, Progress } from '#lib/library.js';
import type { Database } from './db';

const BlocksSchema = v.array(
	v.variant('type', [
		v.object({ type: v.literal('text'), text: v.string() }),
		v.object({ type: v.literal('heading'), text: v.string() }),
		v.object({ type: v.literal('break') })
	])
);

interface BookRow {
	id: string;
	title: string;
	author: string | null;
	language: string | null;
	source: BookSource;
	chapter_count: number;
	word_count: number;
	created_at: number;
	opened_at: number | null;
	has_cover: number;
	progress_chapter: number | null;
	progress_block: number | null;
	progress_at: number | null;
}

const BOOK_COLUMNS = `
	b.id, b.title, b.author, b.language, b.source, b.chapter_count, b.word_count,
	b.created_at, b.opened_at,
	EXISTS (SELECT 1 FROM covers c WHERE c.book_id = b.id) AS has_cover,
	p.chapter AS progress_chapter, p.block AS progress_block, p.updated_at AS progress_at
	FROM books b LEFT JOIN progress p ON p.book_id = b.id`;

function toSummary(row: BookRow): BookSummary {
	const progress: Progress | null =
		row.progress_chapter === null || row.progress_block === null || row.progress_at === null
			? null
			: { chapter: row.progress_chapter, block: row.progress_block, updatedAt: row.progress_at };
	return {
		id: row.id,
		title: row.title,
		author: row.author,
		language: row.language,
		source: row.source,
		chapterCount: row.chapter_count,
		wordCount: row.word_count,
		createdAt: row.created_at,
		openedAt: row.opened_at,
		hasCover: row.has_cover === 1,
		progress
	};
}

/** Parsed chapters kept in memory: playback asks for the same chapter once per segment. */
const CHAPTER_CACHE_SIZE = 16;

export class Library {
	readonly #chapters = new Map<string, ChapterContent>();

	constructor(private readonly db: Database) {}

	list(): BookSummary[] {
		const rows = this.db
			.statement(`SELECT ${BOOK_COLUMNS} ORDER BY coalesce(b.opened_at, b.created_at) DESC`)
			.all() as unknown as BookRow[];
		return rows.map(toSummary);
	}

	get(id: string): BookDetail | null {
		const row = this.db.statement(`SELECT ${BOOK_COLUMNS} WHERE b.id = ?`).get(id) as
			BookRow | undefined;
		if (!row) return null;
		const chapters = this.db
			.statement(`SELECT title, word_count FROM chapters WHERE book_id = ? ORDER BY position`)
			.all(id) as unknown as { title: string; word_count: number }[];
		return {
			...toSummary(row),
			chapters: chapters.map((c) => ({ title: c.title, wordCount: c.word_count }))
		};
	}

	chapter(id: string, position: number): ChapterContent | null {
		const key = `${id}:${position}`;
		const cached = this.#chapters.get(key);
		if (cached) {
			// Re-insert to mark as most recently used.
			this.#chapters.delete(key);
			this.#chapters.set(key, cached);
			return cached;
		}
		const row = this.db
			.statement(`SELECT title, blocks FROM chapters WHERE book_id = ? AND position = ?`)
			.get(id, position) as { title: string; blocks: string } | undefined;
		if (!row) return null;
		const chapter = {
			position,
			title: row.title,
			blocks: v.parse(BlocksSchema, JSON.parse(row.blocks))
		};
		this.#chapters.set(key, chapter);
		if (this.#chapters.size > CHAPTER_CACHE_SIZE) {
			this.#chapters.delete(this.#chapters.keys().next().value!);
		}
		return chapter;
	}

	cover(id: string): { mime: string; bytes: Uint8Array } | null {
		const row = this.db.statement(`SELECT mime, bytes FROM covers WHERE book_id = ?`).get(id) as
			{ mime: string; bytes: Uint8Array } | undefined;
		return row ?? null;
	}

	/** Stores a parsed book in one transaction and returns its new id. */
	add(book: ParsedBook): string {
		if (book.chapters.length === 0) throw new Error('A book needs at least one chapter');
		if (book.chapters.some((c) => c.blocks.length === 0)) {
			throw new Error('Every chapter needs at least one block');
		}
		const id = crypto.randomUUID();
		const now = Date.now();
		const chapterWords = book.chapters.map((c) => countWords(c.blocks));
		this.db.transaction(() => {
			this.db
				.statement(
					`INSERT INTO books (id, title, author, language, source, chapter_count, word_count, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					id,
					book.title,
					book.author,
					book.language,
					book.source,
					book.chapters.length,
					chapterWords.reduce((a, b) => a + b, 0),
					now
				);
			const insertChapter = this.db.statement(
				`INSERT INTO chapters (book_id, position, title, blocks, block_count, word_count)
				 VALUES (?, ?, ?, ?, ?, ?)`
			);
			book.chapters.forEach((chapter, position) => {
				insertChapter.run(
					id,
					position,
					chapter.title,
					JSON.stringify(chapter.blocks satisfies Block[]),
					chapter.blocks.length,
					chapterWords[position]
				);
			});
			if (book.cover) {
				this.db
					.statement(`INSERT INTO covers (book_id, mime, bytes) VALUES (?, ?, ?)`)
					.run(id, book.cover.mime, book.cover.bytes);
			}
		});
		return id;
	}

	/** Returns false when there was no such book. */
	remove(id: string): boolean {
		for (const key of this.#chapters.keys())
			if (key.startsWith(`${id}:`)) this.#chapters.delete(key);
		return this.db.statement(`DELETE FROM books WHERE id = ?`).run(id).changes > 0;
	}

	rename(id: string, title: string, author: string | null): boolean {
		return (
			this.db
				.statement(`UPDATE books SET title = ?, author = ? WHERE id = ?`)
				.run(title, author, id).changes > 0
		);
	}

	markOpened(id: string): void {
		this.db.statement(`UPDATE books SET opened_at = ? WHERE id = ?`).run(Date.now(), id);
	}

	/**
	 * Saves the reading position. Positions outside the book are rejected so a stale or
	 * forged request can't store a place that doesn't exist.
	 */
	saveProgress(id: string, chapter: number, block: number): 'saved' | 'no-book' | 'out-of-range' {
		const row = this.db
			.statement(`SELECT block_count FROM chapters WHERE book_id = ? AND position = ?`)
			.get(id, chapter) as { block_count: number } | undefined;
		if (!row) {
			const exists = this.db.statement(`SELECT 1 FROM books WHERE id = ?`).get(id);
			return exists ? 'out-of-range' : 'no-book';
		}
		if (block >= row.block_count) return 'out-of-range';
		this.db
			.statement(
				`INSERT INTO progress (book_id, chapter, block, updated_at) VALUES (?, ?, ?, ?)
				 ON CONFLICT (book_id) DO UPDATE SET chapter = excluded.chapter, block = excluded.block,
				 updated_at = excluded.updated_at`
			)
			.run(id, chapter, block, Date.now());
		return 'saved';
	}
}
