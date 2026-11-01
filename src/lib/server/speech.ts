/**
 * Speech generation with a disk cache.
 *
 * - Audio is cached by a hash of everything that shapes it (text, voice settings, engine and
 *   model), so the same passage is never generated twice and the URL can be cached forever.
 * - AllTalk works on one request at a time, so requests go through one queue. "now" (the
 *   passage someone is waiting to hear) jumps ahead of "soon" (prefetching).
 * - Identical requests share one generation. A queued request that every caller has abandoned
 *   is dropped before it reaches AllTalk.
 * - The cache is capped; the least recently played audio is removed first.
 */

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { VoiceSettings } from '#lib/settings.js';
import type { AllTalk, EngineInfo } from './alltalk.js';
import type { Database } from './db.js';
import type { Transcoder } from './transcode.js';

export type Priority = 'now' | 'soon';

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
	wav: 'audio/wav',
	mp3: 'audio/mpeg',
	ogg: 'audio/ogg',
	opus: 'audio/ogg',
	aac: 'audio/aac',
	flac: 'audio/flac',
	m4a: 'audio/mp4'
};
export const AUDIO_HASH = /^[0-9a-f]{64}$/;

export interface CachedAudio {
	path: string;
	mime: string;
	bytes: number;
}

interface Listener {
	resolve: (hash: string) => void;
	reject: (error: unknown) => void;
}

interface Job {
	hash: string;
	text: string;
	settings: VoiceSettings;
	priority: Priority;
	started: boolean;
	listeners: Set<Listener>;
}

export class SpeechCancelled extends Error {
	constructor() {
		super('Speech request cancelled');
	}
}

export class Speech {
	readonly #queue: Job[] = [];
	readonly #jobs = new Map<string, Job>();
	#running: Job | null = null;
	#dirReady: Promise<unknown> | null = null;

	private readonly db: Database;
	private readonly alltalk: AllTalk;
	private readonly dir: string;
	private readonly maxCacheBytes: number;
	private readonly engineInfo: () => Promise<EngineInfo>;
	private readonly transcoder: Promise<Transcoder | null>;

	constructor(options: {
		db: Database;
		alltalk: AllTalk;
		dir: string;
		maxCacheBytes: number;
		engineInfo: () => Promise<EngineInfo>;
		/** Compresses generated audio, if available. */
		transcoder?: Promise<Transcoder | null>;
	}) {
		this.db = options.db;
		this.alltalk = options.alltalk;
		this.dir = options.dir;
		this.maxCacheBytes = options.maxCacheBytes;
		this.engineInfo = options.engineInfo;
		this.transcoder = options.transcoder ?? Promise.resolve(null);
	}

	/** The cache key: everything that changes what the audio sounds like. */
	async key(text: string, settings: VoiceSettings): Promise<string> {
		const engine = await this.engineInfo();
		const parts: unknown[] = [
			1,
			engine.engine,
			engine.model,
			settings.voice,
			settings.narratorEnabled,
			settings.narratorEnabled ? settings.narratorVoice : '',
			settings.narratorEnabled ? settings.unquotedIs : '',
			settings.language,
			settings.temperature,
			settings.repetitionPenalty,
			settings.rvcVoice,
			settings.rvcVoice === 'Disabled' ? 0 : settings.rvcPitch
		];
		// Settings added later go in only when used, so audio cached before them keeps its key.
		const narratorRvc = settings.narratorEnabled && settings.rvcNarratorVoice !== 'Disabled';
		if (narratorRvc)
			parts.push('rvcNarrator', settings.rvcNarratorVoice, settings.rvcNarratorPitch);
		if (settings.pitch !== 0) parts.push('pitch', settings.pitch);
		const material = JSON.stringify([...parts, text]);
		return createHash('sha256').update(material).digest('hex');
	}

	/** Looks up cached audio and marks it as recently used. */
	cached(hash: string): CachedAudio | null {
		if (!AUDIO_HASH.test(hash)) return null;
		const row = this.db.statement(`SELECT mime, bytes FROM audio WHERE hash = ?`).get(hash) as
			{ mime: string; bytes: number } | undefined;
		if (!row) return null;
		this.db.statement(`UPDATE audio SET used_at = ? WHERE hash = ?`).run(Date.now(), hash);
		return { path: join(this.dir, hash), mime: row.mime, bytes: row.bytes };
	}

	/** Resolves with the hash of the audio once it is in the cache. */
	async speak(
		text: string,
		settings: VoiceSettings,
		priority: Priority,
		signal?: AbortSignal
	): Promise<string> {
		const hash = await this.key(text, settings);
		const hit = this.cached(hash);
		if (hit && (await fileExists(hit.path, hit.bytes))) return hash;
		if (hit) this.db.statement(`DELETE FROM audio WHERE hash = ?`).run(hash);

		let job = this.#jobs.get(hash);
		if (!job) {
			job = { hash, text, settings, priority, started: false, listeners: new Set() };
			this.#jobs.set(hash, job);
			this.#enqueue(job);
		} else if (priority === 'now' && job.priority === 'soon' && !job.started) {
			this.#queue.splice(this.#queue.indexOf(job), 1);
			job.priority = 'now';
			this.#enqueue(job);
		}
		return this.#wait(job, signal);
	}

	/** Drops everything queued and asks AllTalk to stop the generation in progress. */
	async stop(): Promise<void> {
		for (const job of this.#queue.splice(0))
			this.#settle(job, { ok: false, error: new SpeechCancelled() });
		if (this.#running) await this.alltalk.stop();
	}

	get pending(): number {
		return this.#queue.length + (this.#running ? 1 : 0);
	}

	#enqueue(job: Job): void {
		if (job.priority === 'now') {
			const firstSoon = this.#queue.findIndex((queued) => queued.priority === 'soon');
			this.#queue.splice(firstSoon === -1 ? this.#queue.length : firstSoon, 0, job);
		} else {
			this.#queue.push(job);
		}
		void this.#pump();
	}

	#wait(job: Job, signal?: AbortSignal): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (signal?.aborted) {
				reject(new SpeechCancelled());
				this.#abandon(job);
				return;
			}
			const listener: Listener = {
				resolve: (hash) => {
					signal?.removeEventListener('abort', onAbort);
					resolve(hash);
				},
				reject: (error) => {
					signal?.removeEventListener('abort', onAbort);
					reject(error);
				}
			};
			const onAbort = () => {
				job.listeners.delete(listener);
				reject(new SpeechCancelled());
				this.#abandon(job);
			};
			job.listeners.add(listener);
			signal?.addEventListener('abort', onAbort, { once: true });
		});
	}

	/** A queued job nobody waits for any more never reaches AllTalk. A started one finishes. */
	#abandon(job: Job): void {
		if (job.listeners.size > 0 || job.started) return;
		const index = this.#queue.indexOf(job);
		if (index !== -1) this.#queue.splice(index, 1);
		this.#jobs.delete(job.hash);
	}

	#settle(job: Job, outcome: { ok: true } | { ok: false; error: unknown }): void {
		this.#jobs.delete(job.hash);
		for (const listener of job.listeners) {
			if (outcome.ok) listener.resolve(job.hash);
			else listener.reject(outcome.error);
		}
		job.listeners.clear();
	}

	async #pump(): Promise<void> {
		if (this.#running) return;
		while (this.#queue.length > 0) {
			const job = this.#queue.shift()!;
			job.started = true;
			this.#running = job;
			try {
				await this.#generate(job);
				this.#settle(job, { ok: true });
			} catch (error) {
				this.#settle(job, { ok: false, error });
			} finally {
				this.#running = null;
			}
		}
	}

	async #generate(job: Job): Promise<void> {
		this.#dirReady ??= mkdir(this.dir, { recursive: true });
		await this.#dirReady;

		const file = await this.alltalk.generate(job.text, job.settings);
		const extension = file.split('.').pop()?.toLowerCase() ?? '';
		let mime = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
		const response = await this.alltalk.audio(file);

		const finalPath = join(this.dir, job.hash);
		const downloadPath = `${finalPath}.${process.pid}.download`;
		const compressedPath = `${finalPath}.${process.pid}.m4a`;
		let bytes = 0;
		const limit = new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				bytes += chunk.length;
				callback(bytes > MAX_AUDIO_BYTES ? new Error('Audio file too large') : null, chunk);
			}
		});
		try {
			await pipeline(
				Readable.fromWeb(response.body as unknown as NodeReadableStream),
				limit,
				createWriteStream(downloadPath, { flags: 'wx' })
			);
			if (bytes === 0) throw new Error('AllTalk sent an empty audio file');

			const transcoder = await this.transcoder;
			if (transcoder) {
				await transcoder.transcode(downloadPath, compressedPath);
				bytes = (await stat(compressedPath)).size;
				if (bytes === 0) throw new Error('Compressed audio is empty');
				await rename(compressedPath, finalPath);
				mime = transcoder.mime;
			} else {
				await rename(downloadPath, finalPath);
			}
		} finally {
			await rm(downloadPath, { force: true });
			await rm(compressedPath, { force: true });
		}

		const now = Date.now();
		this.db
			.statement(
				`INSERT INTO audio (hash, mime, bytes, created_at, used_at) VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (hash) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes,
				 used_at = excluded.used_at`
			)
			.run(job.hash, mime, bytes, now, now);
		await this.#evict(job.hash);
	}

	/** Removes least recently used audio until the cache is back under 90% of its budget. */
	async #evict(keep: string): Promise<void> {
		const { total } = this.db
			.statement(`SELECT coalesce(sum(bytes), 0) AS total FROM audio`)
			.get() as { total: number };
		if (total <= this.maxCacheBytes) return;
		let excess = total - this.maxCacheBytes * 0.9;
		const oldest = this.db
			.statement(`SELECT hash, bytes FROM audio WHERE hash != ? ORDER BY used_at LIMIT 500`)
			.all(keep) as unknown as { hash: string; bytes: number }[];
		for (const { hash, bytes } of oldest) {
			if (excess <= 0) break;
			this.db.statement(`DELETE FROM audio WHERE hash = ?`).run(hash);
			await rm(join(this.dir, hash), { force: true });
			excess -= bytes;
		}
	}
}

async function fileExists(path: string, bytes: number): Promise<boolean> {
	try {
		return (await stat(path)).size === bytes;
	} catch {
		return false;
	}
}
