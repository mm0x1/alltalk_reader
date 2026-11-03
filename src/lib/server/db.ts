/**
 * The library database: SQLite through Node's built-in driver.
 *
 * Every query is a prepared statement with bound parameters; no SQL is ever built from input.
 * Migrations are plain SQL, applied in order and tracked with `PRAGMA user_version`.
 */

import { DatabaseSync, type StatementSync } from 'node:sqlite';

export const MIGRATIONS: readonly string[] = [
	`
	CREATE TABLE books (
		id            TEXT PRIMARY KEY,
		title         TEXT NOT NULL,
		author        TEXT,
		language      TEXT,
		source        TEXT NOT NULL CHECK (source IN ('epub', 'txt', 'paste')),
		chapter_count INTEGER NOT NULL CHECK (chapter_count > 0),
		word_count    INTEGER NOT NULL CHECK (word_count >= 0),
		created_at    INTEGER NOT NULL,
		opened_at     INTEGER
	) STRICT;

	CREATE INDEX books_by_recent ON books (coalesce(opened_at, created_at) DESC);

	CREATE TABLE chapters (
		book_id     TEXT NOT NULL REFERENCES books (id) ON DELETE CASCADE,
		position    INTEGER NOT NULL CHECK (position >= 0),
		title       TEXT NOT NULL,
		blocks      TEXT NOT NULL,
		block_count INTEGER NOT NULL CHECK (block_count > 0),
		word_count  INTEGER NOT NULL CHECK (word_count >= 0),
		PRIMARY KEY (book_id, position)
	) STRICT, WITHOUT ROWID;

	CREATE TABLE covers (
		book_id TEXT PRIMARY KEY REFERENCES books (id) ON DELETE CASCADE,
		mime    TEXT NOT NULL,
		bytes   BLOB NOT NULL
	) STRICT;

	CREATE TABLE progress (
		book_id    TEXT PRIMARY KEY REFERENCES books (id) ON DELETE CASCADE,
		chapter    INTEGER NOT NULL CHECK (chapter >= 0),
		block      INTEGER NOT NULL CHECK (block >= 0),
		updated_at INTEGER NOT NULL
	) STRICT;

	CREATE TABLE settings (
		id   INTEGER PRIMARY KEY CHECK (id = 1),
		data TEXT NOT NULL
	) STRICT;

	CREATE TABLE audio (
		hash       TEXT PRIMARY KEY CHECK (length(hash) = 64),
		mime       TEXT NOT NULL,
		bytes      INTEGER NOT NULL CHECK (bytes > 0),
		created_at INTEGER NOT NULL,
		used_at    INTEGER NOT NULL
	) STRICT, WITHOUT ROWID;

	CREATE INDEX audio_by_use ON audio (used_at);
	`,
	// Where the story starts, past front matter: a new book opens there.
	`ALTER TABLE books ADD COLUMN start_chapter INTEGER NOT NULL DEFAULT 0;`,
	// Books prepared in full: the settings, engine and model they were made with, and the audio
	// they keep (never evicted from the cache).
	`
	CREATE TABLE prepared_books (
		book_id     TEXT PRIMARY KEY REFERENCES books (id) ON DELETE CASCADE,
		settings    TEXT NOT NULL,
		engine      TEXT,
		model       TEXT,
		state       TEXT NOT NULL CHECK (state IN ('preparing', 'paused', 'ready')),
		done        INTEGER NOT NULL DEFAULT 0,
		total       INTEGER NOT NULL DEFAULT 0,
		message     TEXT,
		started_at  INTEGER NOT NULL,
		finished_at INTEGER
	) STRICT;

	CREATE TABLE pinned_audio (
		book_id TEXT NOT NULL REFERENCES books (id) ON DELETE CASCADE,
		hash    TEXT NOT NULL,
		PRIMARY KEY (book_id, hash)
	) STRICT, WITHOUT ROWID;

	CREATE INDEX pinned_audio_by_hash ON pinned_audio (hash);
	`,
	// Every spoken block, for finding a passage (see search.ts). Words match from their start,
	// whatever their case or accents. Filled for books already in the library; emptied with them.
	`
	CREATE VIRTUAL TABLE block_search USING fts5(
		text, book_id UNINDEXED, chapter UNINDEXED, block UNINDEXED,
		tokenize = 'unicode61 remove_diacritics 2'
	);

	INSERT INTO block_search (text, book_id, chapter, block)
		SELECT b.value ->> 'text', c.book_id, c.position, b.key
		FROM chapters c, json_each(c.blocks) b
		WHERE b.value ->> 'type' IN ('text', 'heading');

	CREATE TRIGGER books_search_delete AFTER DELETE ON books BEGIN
		DELETE FROM block_search WHERE book_id = old.id;
	END;
	`
];

export class Database {
	readonly #db: DatabaseSync;
	readonly #statements = new Map<string, StatementSync>();

	constructor(path: string) {
		this.#db = new DatabaseSync(path);
		this.#db.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA synchronous = NORMAL;
			PRAGMA foreign_keys = ON;
			PRAGMA busy_timeout = 5000;
		`);
		this.#migrate();
	}

	/** Returns a cached prepared statement for this SQL. */
	statement(sql: string): StatementSync {
		let statement = this.#statements.get(sql);
		if (!statement) {
			statement = this.#db.prepare(sql);
			this.#statements.set(sql, statement);
		}
		return statement;
	}

	/** Runs `fn` in a write transaction; rolls back if it throws. Not re-entrant. */
	transaction<T>(fn: () => T): T {
		this.#db.exec('BEGIN IMMEDIATE');
		try {
			const result = fn();
			this.#db.exec('COMMIT');
			return result;
		} catch (error) {
			this.#db.exec('ROLLBACK');
			throw error;
		}
	}

	close(): void {
		this.#db.close();
	}

	#migrate(): void {
		const { user_version: current } = this.#db.prepare('PRAGMA user_version').get() as {
			user_version: number;
		};
		if (current > MIGRATIONS.length) {
			throw new Error(
				`The library database is from a newer Readhouse (schema ${current}); update Readhouse.`
			);
		}
		for (let version = current; version < MIGRATIONS.length; version++) {
			this.transaction(() => {
				this.#db.exec(MIGRATIONS[version]);
				// user_version can't be a bound parameter; `version` is a trusted loop counter.
				this.#db.exec(`PRAGMA user_version = ${version + 1}`);
			});
		}
	}
}
