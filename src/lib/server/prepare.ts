/**
 * Preparing a whole book: every passage generated ahead and kept, so the book plays later even
 * with AllTalk switched off.
 *
 * The voice settings, passage length, engine and model of the moment are saved with the book
 * (its snapshot). From then on the book is read with them, whatever the library's settings
 * become, and its audio is pinned so the cache never evicts it. One book is prepared at a time,
 * at the lowest priority, behind anything being listened to. If AllTalk switches to another
 * model, or stops answering, preparation pauses with a reason and can be continued.
 */

import * as v from 'valibot';
import type { Preparation } from '#lib/library.js';
import { VoiceSettingsSchema, type VoiceSettings } from '#lib/settings.js';
import { passageText } from '#lib/text/passages.js';
import { AllTalkError } from './alltalk.js';
import type { Database } from './db.js';
import type { Library } from './library.js';
import { ModelChanged, SpeechCancelled, type Snapshot, type Speech } from './speech.js';

interface Row {
	settings: string;
	engine: string | null;
	model: string | null;
	state: Preparation['state'];
	done: number;
	total: number;
	message: string | null;
	finished_at: number | null;
}

/** What a prepared book is read with. */
export interface BookVoice {
	settings: VoiceSettings;
	snapshot: Snapshot;
}

export class Preparer {
	readonly #waiting: string[] = [];
	#running: { bookId: string; controller: AbortController } | null = null;

	constructor(
		private readonly db: Database,
		private readonly library: Library,
		private readonly speech: Speech
	) {
		// Work cut short by a restart waits to be continued.
		this.db
			.statement(
				`UPDATE prepared_books SET state = 'paused', message = ? WHERE state = 'preparing'`
			)
			.run('Readhouse restarted. Continue to finish preparing.');
	}

	#row(bookId: string): Row | undefined {
		return this.db
			.statement(
				`SELECT settings, engine, model, state, done, total, message, finished_at
				 FROM prepared_books WHERE book_id = ?`
			)
			.get(bookId) as Row | undefined;
	}

	/** The settings a prepared book is read with, or null when it isn't prepared. */
	voice(bookId: string): BookVoice | null {
		const row = this.#row(bookId);
		if (!row) return null;
		const parsed = v.safeParse(VoiceSettingsSchema, JSON.parse(row.settings));
		if (!parsed.success) return null;
		return { settings: parsed.output, snapshot: { engine: row.engine, model: row.model } };
	}

	status(bookId: string): Preparation | null {
		const row = this.#row(bookId);
		const voice = this.voice(bookId);
		if (!row || !voice) return null;
		return {
			state: row.state,
			done: row.done,
			total: row.total,
			message: row.message,
			voice: voice.settings.voice,
			model: row.model,
			passageChars: voice.settings.passageChars,
			finishedAt: row.finished_at
		};
	}

	/** Starts afresh with these settings and AllTalk's engine and model, replacing any earlier. */
	start(bookId: string, settings: VoiceSettings, snapshot: Snapshot): void {
		this.forget(bookId);
		this.db
			.statement(
				`INSERT INTO prepared_books (book_id, settings, engine, model, state, started_at)
				 VALUES (?, ?, ?, ?, 'preparing', ?)`
			)
			.run(bookId, JSON.stringify(settings), snapshot.engine, snapshot.model, Date.now());
		this.#enqueue(bookId);
	}

	/** Picks a paused preparation up again, with its own settings. */
	continue(bookId: string): void {
		const row = this.#row(bookId);
		if (!row || row.state === 'ready') return;
		this.#set(bookId, 'preparing', null);
		this.#enqueue(bookId);
	}

	stop(bookId: string): void {
		const index = this.#waiting.indexOf(bookId);
		if (index !== -1) this.#waiting.splice(index, 1);
		if (this.#running?.bookId === bookId) this.#running.controller.abort();
		const row = this.#row(bookId);
		if (row && row.state === 'preparing') this.#set(bookId, 'paused', 'Stopped.');
	}

	/** Back to the library's settings: the record and its pins go (the audio may age out). */
	forget(bookId: string): void {
		this.stop(bookId);
		this.db.transaction(() => {
			this.db.statement(`DELETE FROM pinned_audio WHERE book_id = ?`).run(bookId);
			this.db.statement(`DELETE FROM prepared_books WHERE book_id = ?`).run(bookId);
		});
	}

	/** Resolves once nothing is being prepared (for tests). */
	async idle(): Promise<void> {
		while (this.#running || this.#waiting.length) {
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	}

	#set(bookId: string, state: Preparation['state'], message: string | null): void {
		this.db
			.statement(
				`UPDATE prepared_books SET state = ?, message = ?,
				 finished_at = CASE WHEN ? = 'ready' THEN ? ELSE NULL END WHERE book_id = ?`
			)
			.run(state, message, state, Date.now(), bookId);
	}

	#enqueue(bookId: string): void {
		if (this.#running?.bookId === bookId || this.#waiting.includes(bookId)) return;
		this.#waiting.push(bookId);
		void this.#pump();
	}

	async #pump(): Promise<void> {
		if (this.#running) return;
		while (this.#waiting.length) {
			const bookId = this.#waiting.shift()!;
			const controller = new AbortController();
			this.#running = { bookId, controller };
			try {
				await this.#prepare(bookId, controller.signal);
			} finally {
				this.#running = null;
			}
		}
	}

	async #prepare(bookId: string, signal: AbortSignal): Promise<void> {
		const book = this.library.get(bookId);
		const voice = this.voice(bookId);
		if (!book || !voice) return;
		const chars = voice.settings.passageChars;
		const chapters = Array.from({ length: book.chapterCount }, (_, index) =>
			this.library.chapter(bookId, index, chars)
		);
		const total = chapters.reduce((sum, chapter) => sum + (chapter?.passages.length ?? 0), 0);
		this.db.statement(`UPDATE prepared_books SET total = ? WHERE book_id = ?`).run(total, bookId);

		const pin = this.db.statement(
			`INSERT OR IGNORE INTO pinned_audio (book_id, hash) VALUES (?, ?)`
		);
		const progress = this.db.statement(`UPDATE prepared_books SET done = ? WHERE book_id = ?`);
		let done = 0;
		try {
			for (const chapter of chapters) {
				for (const passage of chapter?.passages ?? []) {
					const text = passageText(chapter!.blocks, passage);
					const hash = await this.speech.speak(
						text,
						voice.settings,
						'later',
						signal,
						voice.snapshot
					);
					pin.run(bookId, hash);
					progress.run(++done, bookId);
				}
			}
			this.#set(bookId, 'ready', null);
		} catch (error) {
			if (signal.aborted) return; // Stopped or forgotten; the record says so already.
			this.#set(bookId, 'paused', reason(error));
		}
	}
}

function reason(error: unknown): string {
	if (error instanceof ModelChanged) return error.message;
	if (error instanceof SpeechCancelled) return 'AllTalk was told to stop. Continue to finish.';
	if (error instanceof AllTalkError && error.kind === 'unreachable') {
		return 'AllTalk isn’t answering. Continue once it’s running.';
	}
	return error instanceof Error ? `${error.message.slice(0, 200)}` : 'Something went wrong.';
}
