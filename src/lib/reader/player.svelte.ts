/**
 * Plays a book aloud, segment by segment.
 *
 * - One audio element for the whole session, first played inside a user gesture: iOS only lets
 *   an element play programmatically after that.
 * - Every jump bumps `#generation`; async work started for an older generation is ignored, so
 *   fast tapping can never leave two passages playing or a stale one starting.
 * - The next few segments are requested ahead ("soon") and their audio warmed into the HTTP
 *   cache, so playback continues without gaps; prefetches are aborted on every jump.
 */

import { api, ApiError } from '#lib/client/api.js';
import {
	markChapterSaved,
	recallSpeech,
	rememberSpeech,
	requestPersistence,
	saveAudio
} from '#lib/client/offline.js';
import type { BookDetail, ChapterContent } from '#lib/library.js';
import {
	chapterPositions,
	firstSpoken,
	lastSpokenBefore,
	nextInChapter,
	previousInChapter,
	type Position
} from './position.js';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/** Stop after some minutes, or at the end of the current chapter. */
export type SleepTimer = { kind: 'minutes'; endsAt: number } | { kind: 'chapter' } | null;
const SLEEP_FADE_MS = 8_000;

const PREFETCH_AHEAD = 3;
const SAVE_INTERVAL_MS = 5_000;
const CHAPTER_CACHE = 6;
const SILENCE = '/silence.wav';
const RATE_KEY = 'readhouse:rate';
export const RATES = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;

function readRate(): number {
	try {
		const stored = Number(localStorage.getItem(RATE_KEY));
		return RATES.includes(stored as (typeof RATES)[number]) ? stored : 1;
	} catch {
		return 1;
	}
}

function isAbort(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}

function describe(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.status === 503) return 'AllTalk isn\u2019t answering. Check that it\u2019s running.';
		return error.message;
	}
	if (error instanceof DOMException && error.name === 'NotAllowedError') {
		return 'Tap play to start listening.';
	}
	if (error instanceof TypeError) return 'Readhouse can\u2019t be reached. Check your connection.';
	return 'Something went wrong while reading aloud.';
}

export class Player {
	status = $state<PlayerStatus>('idle');
	message = $state<string | null>(null);
	position = $state<Position>({ chapter: 0, block: 0, segment: 0 });
	/** The chapter being shown/read. Raw: large and never mutated, so no deep proxy. */
	chapter = $state.raw<ChapterContent | null>(null);
	rate = $state(1);
	sleep = $state<SleepTimer>(null);

	readonly book: BookDetail;
	readonly #maxChars: number;
	#audio: HTMLAudioElement | null = null;
	#unlocked = false;
	#switching = false;
	/** Position whose audio is loaded in the element, if any. */
	#loaded: string | null = null;
	#generation = 0;
	#current: AbortController | null = null;
	#prefetch: AbortController | null = null;
	// A plain cache, deliberately not reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	readonly #chapters = new Map<number, Promise<ChapterContent>>();
	#lastSaved = 0;
	#sleepTimer: ReturnType<typeof setTimeout> | null = null;
	#fadeTimer: ReturnType<typeof setInterval> | null = null;

	constructor(book: BookDetail, maxChars: number, start: Position, chapter: ChapterContent) {
		this.book = book;
		this.#maxChars = maxChars;
		this.position = start;
		this.chapter = chapter;
		this.#chapters.set(chapter.position, Promise.resolve(chapter));
		this.rate = readRate();
	}

	get active(): boolean {
		return this.status === 'playing' || this.status === 'loading';
	}

	/** Starts or resumes. Call from a tap or key press: the first play must be a user gesture. */
	play(): void {
		const audio = this.#ensureAudio();
		if (this.status === 'paused' && this.#loaded === key(this.position) && !audio.ended) {
			this.status = 'playing';
			audio.play().catch((error) => this.#fail(error));
			return;
		}
		this.#unlock(audio);
		void this.#start(this.position);
	}

	pause(): void {
		this.#generation++;
		this.#abort();
		this.#audio?.pause();
		if (this.status !== 'idle') this.status = 'paused';
		this.#save(true);
	}

	toggle(): void {
		if (this.active) this.pause();
		else this.play();
	}

	/** Moves to a place in the book; keeps playing if it was playing. Call from a gesture. */
	async seek(position: Position, autoplay = this.active): Promise<void> {
		this.#generation++;
		this.#abort();
		if (autoplay) {
			this.#unlock(this.#ensureAudio());
			void this.#start(position);
			return;
		}
		this.#audio?.pause();
		this.#loaded = null;
		this.position = position;
		if (this.status !== 'idle') this.status = 'paused';
		const generation = this.#generation;
		const chapter = await this.#chapter(position.chapter).catch(() => null);
		if (chapter && generation === this.#generation) this.chapter = chapter;
		this.#save(true);
	}

	async next(): Promise<void> {
		const target = await this.#after(this.position);
		if (target) await this.seek(target);
	}

	async previous(): Promise<void> {
		const target = await this.#before(this.position);
		if (target) await this.seek(target);
	}

	async openChapter(index: number, autoplay = this.active): Promise<void> {
		if (index < 0 || index >= this.book.chapterCount) return;
		const chapter = await this.#chapter(index);
		const block = firstSpoken(chapter.blocks) ?? 0;
		await this.seek({ chapter: index, block, segment: 0 }, autoplay);
	}

	setRate(rate: number): void {
		this.rate = rate;
		if (this.#audio) this.#audio.playbackRate = rate;
		try {
			localStorage.setItem(RATE_KEY, String(rate));
		} catch {
			// Private mode or storage disabled: the rate just isn't remembered.
		}
	}

	/** Pauses after `minutes`, at the end of this chapter (`'chapter'`), or never (`null`). */
	setSleepTimer(choice: number | 'chapter' | null): void {
		this.#clearSleep();
		if (choice === null) {
			this.sleep = null;
		} else if (choice === 'chapter') {
			this.sleep = { kind: 'chapter' };
		} else {
			const endsAt = Date.now() + choice * 60_000;
			this.sleep = { kind: 'minutes', endsAt };
			this.#sleepTimer = setTimeout(
				() => this.#fadeToSleep(),
				Math.max(0, endsAt - Date.now() - SLEEP_FADE_MS)
			);
		}
	}

	/**
	 * Lowers the volume over a few seconds, then pauses: kinder than a cut when falling asleep.
	 * (iOS doesn't let pages change the volume, so there it simply pauses on time.)
	 */
	#fadeToSleep(): void {
		const audio = this.#audio;
		if (!audio || !this.active) {
			this.#sleepNow();
			return;
		}
		const started = Date.now();
		this.#fadeTimer = setInterval(() => {
			const progress = (Date.now() - started) / SLEEP_FADE_MS;
			if (progress >= 1) this.#sleepNow();
			else audio.volume = Math.max(0, 1 - progress);
		}, 200);
	}

	#sleepNow(): void {
		// Pause before restoring the volume, or the last moment plays at full volume.
		this.pause();
		this.#clearSleep();
		this.sleep = null;
		this.message = 'Sleep timer: paused. Sleep well.';
	}

	#clearSleep(): void {
		if (this.#sleepTimer) clearTimeout(this.#sleepTimer);
		if (this.#fadeTimer) clearInterval(this.#fadeTimer);
		this.#sleepTimer = this.#fadeTimer = null;
		if (this.#audio) this.#audio.volume = 1;
	}

	/** Saves the reading position now, surviving page close (keepalive). */
	saveNow(): void {
		this.#save(true, true);
	}

	destroy(): void {
		this.#clearSleep();
		this.#generation++;
		this.#abort();
		this.#save(true, true);
		if (this.#audio) {
			this.#audio.pause();
			this.#audio.removeAttribute('src');
			this.#audio.load();
			this.#audio = null;
		}
		if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
	}

	// --- internals --------------------------------------------------------------------------

	#ensureAudio(): HTMLAudioElement {
		if (this.#audio) return this.#audio;
		const audio = new Audio();
		audio.preload = 'auto';
		audio.preservesPitch = true;
		audio.addEventListener('ended', () => {
			if (!audio.src.endsWith(SILENCE)) void this.#advance();
		});
		audio.addEventListener('error', () => {
			if (audio.src && !audio.src.endsWith(SILENCE) && !this.#switching) {
				this.#fail(new Error('audio'));
			}
		});
		// Pauses and plays from outside (headphones unplugged, lock screen, other apps).
		audio.addEventListener('pause', () => {
			if (!this.#switching && !audio.ended && this.status === 'playing') this.pause();
		});
		this.#audio = audio;
		this.#setupMediaSession();
		return audio;
	}

	/** iOS lets an element play later only if it first played during a user gesture. */
	#unlock(audio: HTMLAudioElement): void {
		if (this.#unlocked) return;
		this.#unlocked = true;
		audio.src = SILENCE;
		audio.play().catch(() => undefined);
	}

	#abort(): void {
		this.#current?.abort();
		this.#prefetch?.abort();
		this.#current = this.#prefetch = null;
	}

	async #start(position: Position): Promise<void> {
		const generation = ++this.#generation;
		this.#abort();
		this.position = position;
		this.status = 'loading';
		this.message = null;
		const controller = new AbortController();
		this.#current = controller;
		try {
			const chapter = await this.#chapter(position.chapter);
			if (generation !== this.#generation) return;
			this.chapter = chapter;
			const url = await this.#audioFor(position, 'now', controller.signal);
			if (generation !== this.#generation) return;

			const audio = this.#ensureAudio();
			this.#switching = true;
			audio.src = url;
			audio.playbackRate = this.rate;
			this.#loaded = key(position);
			this.#switching = false;
			await audio.play();
			if (generation !== this.#generation) return;

			this.status = 'playing';
			this.#updateMediaSession();
			this.#save(false);
			void this.#prefetchAfter(position, generation);
		} catch (error) {
			this.#switching = false;
			if (generation !== this.#generation || isAbort(error)) return;
			this.#fail(error);
		}
	}

	async #advance(): Promise<void> {
		const generation = this.#generation;
		const next = await this.#after(this.position).catch(() => null);
		if (generation !== this.#generation) return;
		if (!next) {
			this.status = 'idle';
			this.message = 'The end.';
			this.#save(true);
			return;
		}
		if (this.sleep?.kind === 'chapter' && next.chapter !== this.position.chapter) {
			// Stop at the chapter's end, but resume from the next chapter's start.
			this.position = next;
			this.#loaded = null;
			this.#sleepNow();
			return;
		}
		void this.#start(next);
	}

	#fail(error: unknown): void {
		this.status = 'error';
		this.message = describe(error);
		this.#audio?.pause();
	}

	async #prefetchAfter(from: Position, generation: number): Promise<void> {
		const controller = new AbortController();
		this.#prefetch = controller;
		let position: Position | null = from;
		try {
			for (let i = 0; i < PREFETCH_AHEAD; i++) {
				position = await this.#after(position);
				if (!position || generation !== this.#generation) return;
				const url = await this.#audioFor(position, 'soon', controller.signal);
				// Pull the audio into the cache (it is immutable) so the switch is instant.
				const response = await fetch(url, { signal: controller.signal });
				await response.arrayBuffer();
			}
		} catch {
			// Prefetching is best effort; the real request will report any problem.
		}
	}

	/**
	 * The audio URL for a passage: asks the server (which generates it if needed) and remembers
	 * the answer, or falls back to what this device remembers when the server can't be reached.
	 */
	async #audioFor(
		position: Position,
		priority: 'now' | 'soon',
		signal: AbortSignal
	): Promise<string> {
		try {
			const { audio } = await api.speech({ bookId: this.book.id, ...position, priority }, signal);
			void rememberSpeech(this.book.id, position, audio);
			return audio;
		} catch (error) {
			if (isAbort(error)) throw error;
			const offline =
				error instanceof TypeError || (error instanceof ApiError && error.status >= 502);
			const saved = offline ? await recallSpeech(this.book.id, position) : null;
			if (saved) return saved;
			throw error;
		}
	}

	/**
	 * Prepares a whole chapter and saves its audio on this device for offline listening.
	 * Generation runs in the background queue behind whatever is playing.
	 */
	async saveChapter(
		index: number,
		onProgress: (done: number, total: number) => void,
		signal: AbortSignal
	): Promise<void> {
		void requestPersistence();
		const chapter = await this.#chapter(index);
		const positions = chapterPositions(index, chapter.blocks, this.#maxChars);
		onProgress(0, positions.length);
		for (const [done, position] of positions.entries()) {
			const { audio } = await api.speech(
				{ bookId: this.book.id, ...position, priority: 'soon' },
				signal
			);
			await rememberSpeech(this.book.id, position, audio);
			await saveAudio(audio, signal);
			onProgress(done + 1, positions.length);
		}
		await markChapterSaved(this.book.id, index);
	}

	async #after(position: Position): Promise<Position | null> {
		const chapter = await this.#chapter(position.chapter);
		const next = nextInChapter(chapter.blocks, position, this.#maxChars);
		if (next) return next;
		for (let index = position.chapter + 1; index < this.book.chapterCount; index++) {
			const block = firstSpoken((await this.#chapter(index)).blocks);
			if (block !== null) return { chapter: index, block, segment: 0 };
		}
		return null;
	}

	async #before(position: Position): Promise<Position | null> {
		const chapter = await this.#chapter(position.chapter);
		const previous = previousInChapter(chapter.blocks, position);
		if (previous) return previous;
		for (let index = position.chapter - 1; index >= 0; index--) {
			const blocks = (await this.#chapter(index)).blocks;
			const block = lastSpokenBefore(blocks, blocks.length);
			if (block !== null) return { chapter: index, block, segment: 0 };
		}
		return null;
	}

	#chapter(index: number): Promise<ChapterContent> {
		let chapter = this.#chapters.get(index);
		if (!chapter) {
			chapter = api.chapter(this.book.id, index);
			chapter.catch(() => this.#chapters.delete(index));
			this.#chapters.set(index, chapter);
			// Keep memory bounded on long books: drop the oldest other chapter.
			if (this.#chapters.size > CHAPTER_CACHE) {
				for (const old of this.#chapters.keys()) {
					if (old !== index && old !== this.position.chapter) {
						this.#chapters.delete(old);
						break;
					}
				}
			}
		}
		return chapter;
	}

	#save(force: boolean, keepalive = false): void {
		const now = Date.now();
		if (!force && now - this.#lastSaved < SAVE_INTERVAL_MS) return;
		this.#lastSaved = now;
		const { chapter, block } = this.position;
		api.saveProgress(this.book.id, chapter, block, keepalive).catch(() => undefined);
	}

	#setupMediaSession(): void {
		if (!('mediaSession' in navigator)) return;
		const session = navigator.mediaSession;
		session.setActionHandler('play', () => this.play());
		session.setActionHandler('pause', () => this.pause());
		session.setActionHandler('previoustrack', () => void this.previous());
		session.setActionHandler('nexttrack', () => void this.next());
	}

	#updateMediaSession(): void {
		if (!('mediaSession' in navigator)) return;
		const chapterTitle = this.book.chapters[this.position.chapter]?.title ?? this.book.title;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: chapterTitle,
			artist: this.book.author ?? '',
			album: this.book.title,
			artwork: this.book.hasCover ? [{ src: `/api/books/${this.book.id}/cover` }] : []
		});
	}
}

function key(position: Position): string {
	return `${position.chapter}:${position.block}:${position.segment}`;
}
