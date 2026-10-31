/**
 * What this device can play without a connection.
 *
 * The service worker keeps the audio files; this module remembers which audio belongs to which
 * passage (IndexedDB), so the player can find it when the server can't be reached. Offline
 * storage needs a secure context (HTTPS or localhost); on plain http it reports unavailable.
 */

import type { Position } from '#lib/reader/position.js';
import {
	BOOK_CACHE,
	PAGE_CACHE,
	RECENT_AUDIO_CACHE,
	SAVE_HEADER,
	SAVED_AUDIO_CACHE
} from '#lib/offline-shared.js';

const DB_NAME = 'readhouse';
const SPEECH = 'speech';
const SAVED = 'saved-chapters';

export function offlineAvailable(): boolean {
	return (
		typeof window !== 'undefined' &&
		window.isSecureContext &&
		'caches' in window &&
		'indexedDB' in window
	);
}

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	database ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(SPEECH);
			request.result.createObjectStore(SAVED);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	database.catch(() => (database = null));
	return database;
}

function promised<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
	return (await open()).transaction(name, mode).objectStore(name);
}

const speechKey = (bookId: string, p: Position) => `${bookId}/${p.chapter}/${p.block}/${p.segment}`;
const bookRange = (bookId: string) => IDBKeyRange.bound(`${bookId}/`, `${bookId}/￿`);

/** Records which audio plays this passage. Best effort: failures are ignored. */
export async function rememberSpeech(bookId: string, position: Position, audio: string) {
	if (!offlineAvailable()) return;
	try {
		await promised((await store(SPEECH, 'readwrite')).put(audio, speechKey(bookId, position)));
	} catch {
		// Storage full or unavailable: offline playback just won't cover this passage.
	}
}

export async function recallSpeech(bookId: string, position: Position): Promise<string | null> {
	if (!offlineAvailable()) return null;
	try {
		const audio = await promised(
			(await store(SPEECH, 'readonly')).get(speechKey(bookId, position))
		);
		return typeof audio === 'string' ? audio : null;
	} catch {
		return null;
	}
}

/** Downloads one audio file into the "saved" cache via the service worker. */
export async function saveAudio(url: string, signal?: AbortSignal): Promise<void> {
	const response = await fetch(url, { headers: { [SAVE_HEADER]: '1' }, signal });
	if (!response.ok) throw new Error(`Could not save audio (${response.status})`);
	await response.arrayBuffer();
}

export async function markChapterSaved(bookId: string, chapter: number): Promise<void> {
	await promised((await store(SAVED, 'readwrite')).put(Date.now(), `${bookId}/${chapter}`));
}

export async function savedChapters(bookId: string): Promise<Set<number>> {
	if (!offlineAvailable()) return new Set();
	try {
		const keys = await promised((await store(SAVED, 'readonly')).getAllKeys(bookRange(bookId)));
		return new Set(keys.map((key) => Number(String(key).split('/')[1])));
	} catch {
		return new Set();
	}
}

/** Forgets a book's offline index (its cached files age out of the caches on their own). */
export async function forgetBook(bookId: string): Promise<void> {
	if (!offlineAvailable()) return;
	try {
		await promised((await store(SPEECH, 'readwrite')).delete(bookRange(bookId)));
		await promised((await store(SAVED, 'readwrite')).delete(bookRange(bookId)));
	} catch {
		// Nothing to forget.
	}
}

export interface StorageUse {
	usedBytes: number | null;
	quotaBytes: number | null;
	persisted: boolean;
}

export async function storageUse(): Promise<StorageUse> {
	const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
	const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
	return {
		usedBytes: estimate?.usage ?? null,
		quotaBytes: estimate?.quota ?? null,
		persisted
	};
}

/** Asks the browser not to evict saved audio under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
	return (await navigator.storage?.persist?.().catch(() => false)) ?? false;
}

/** Removes everything kept for offline use on this device. */
export async function clearOfflineData(): Promise<void> {
	if (!offlineAvailable()) return;
	await Promise.all(
		[RECENT_AUDIO_CACHE, SAVED_AUDIO_CACHE, BOOK_CACHE, PAGE_CACHE].map((name) =>
			caches.delete(name)
		)
	);
	try {
		await promised((await store(SPEECH, 'readwrite')).clear());
		await promised((await store(SAVED, 'readwrite')).clear());
	} catch {
		// Already empty.
	}
}
