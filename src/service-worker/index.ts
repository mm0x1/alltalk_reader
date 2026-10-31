/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Offline support and instant repeat loads.
 *
 * - The app shell (built JS/CSS and static files) is cached per release.
 * - Audio, chapter text and covers have immutable URLs, so they are served cache-first.
 *   Audio heard recently goes in a bounded cache; audio saved for offline in its own cache.
 *   Range requests from <audio> are answered from a cached full response (Safari needs ranges).
 * - Pages and their data are network-first with the last copy as fallback, so a book that was
 *   open can be opened again without a connection.
 * - Everything else (status, library list, writes) always goes to the network.
 */

import { self } from '$app/service-worker';
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { resolve } from '$app/paths';
import {
	BOOK_CACHE,
	PAGE_CACHE,
	PAGE_LIMIT,
	RECENT_AUDIO_CACHE,
	RECENT_AUDIO_LIMIT,
	SAVE_HEADER,
	SAVED_AUDIO_CACHE,
	SHARE_CACHE,
	SHARE_KEY,
	SHARE_PATH
} from '#lib/offline-shared.js';

const SHELL_CACHE = `readhouse-shell-${version}`;
/**
 * Font files for other scripts (Cyrillic, Greek, Vietnamese...) are left out: a browser fetches
 * them only for text that needs them, and precaching them all would cost every phone ~0.5 MB.
 */
const OTHER_SCRIPT_FONT = /\/eb-garamond-(?!latin-)[^/]*\.woff2$/;
const SHELL = [
	...immutable.map((asset) => resolve(asset.path)).filter((path) => !OTHER_SCRIPT_FONT.test(path)),
	...assets.map((asset) => resolve(asset.path))
];
const KEEP = new Set([
	SHELL_CACHE,
	RECENT_AUDIO_CACHE,
	SAVED_AUDIO_CACHE,
	BOOK_CACHE,
	PAGE_CACHE,
	SHARE_CACHE
]);

const AUDIO = /^\/api\/audio\/[0-9a-f]{64}$/;
const BOOK_FILES = /^\/api\/books\/[0-9a-f-]{36}\/(?:chapters\/\d+|cover)$/;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(SHELL_CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (!KEEP.has(key)) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (request.method === 'POST' && url.pathname === SHARE_PATH) {
		event.respondWith(receiveShare(request));
		return;
	}
	if (request.method !== 'GET') return;

	if (SHELL.includes(url.pathname)) {
		event.respondWith(fromCache(SHELL_CACHE, url.pathname, request));
	} else if (AUDIO.test(url.pathname)) {
		event.respondWith(audio(request, url));
	} else if (BOOK_FILES.test(url.pathname)) {
		event.respondWith(cacheFirst(BOOK_CACHE, request));
	} else if (request.mode === 'navigate' || url.pathname.endsWith('/__data.json')) {
		event.respondWith(networkFirst(PAGE_CACHE, request, PAGE_LIMIT));
	}
});

/**
 * The share target (manifest `share_target`): keeps what was shared on this device and opens
 * the library, which adds it. Handled here so the POST never reaches the server.
 */
async function receiveShare(request: Request): Promise<Response> {
	const cache = await caches.open(SHARE_CACHE);
	await cache.delete(SHARE_KEY);
	try {
		const form = await request.formData();
		const file = form.get('book');
		if (file instanceof File && file.size > 0) {
			await cache.put(
				SHARE_KEY,
				new Response(file, {
					headers: {
						'content-type': file.type || 'application/octet-stream',
						'x-file-name': encodeURIComponent(file.name)
					}
				})
			);
		} else {
			const field = (name: string) => {
				const value = form.get(name);
				return typeof value === 'string' ? value : '';
			};
			await cache.put(
				SHARE_KEY,
				Response.json({ title: field('title'), text: field('text'), url: field('url') })
			);
		}
	} catch {
		// Nothing usable was shared; the library opens as usual.
	}
	return Response.redirect(resolve('/') + '?shared', 303);
}

async function fromCache(name: string, key: string, request: Request): Promise<Response> {
	return (await (await caches.open(name)).match(key)) ?? fetch(request);
}

async function cacheFirst(name: string, request: Request): Promise<Response> {
	const cache = await caches.open(name);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.status === 200) void cache.put(request, response.clone());
	return response;
}

async function networkFirst(name: string, request: Request, limit: number): Promise<Response> {
	const cache = await caches.open(name);
	try {
		const response = await fetch(request);
		if (response.status === 200 && !response.redirected) {
			await cache.put(request, response.clone());
			void trim(cache, limit);
		}
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw error;
	}
}

/** Removes the oldest entries (Cache API keys are in insertion order). */
async function trim(cache: Cache, limit: number): Promise<void> {
	const keys = await cache.keys();
	for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}

/**
 * Audio. Range requests come from the <audio> element: online they go straight to the server
 * (which answers ranges itself and is HTTP-cached), because WebKit mishandles media played from
 * responses a service worker builds; the cached copy only answers when the network fails.
 * Whole-file requests come from prefetching and saving, and fill the caches.
 */
async function audio(request: Request, url: URL): Promise<Response> {
	const key = url.pathname;
	const saved = await caches.open(SAVED_AUDIO_CACHE);
	const recent = await caches.open(RECENT_AUDIO_CACHE);
	const range = request.headers.get('range');

	if (range) {
		try {
			return await fetch(request);
		} catch (error) {
			const cached = (await saved.match(key)) ?? (await recent.match(key));
			if (cached) return withRange(cached, range);
			throw error;
		}
	}

	const cached = (await saved.match(key)) ?? (await recent.match(key));
	const target = request.headers.has(SAVE_HEADER) ? saved : recent;
	if (cached) {
		// Saving something already heard moves it to the kept cache.
		if (target === saved && !(await saved.match(key))) await saved.put(key, cached.clone());
		return cached;
	}
	const response = await fetch(key);
	if (response.status !== 200) return response;
	await target.put(key, response.clone());
	if (target === recent) void trim(recent, RECENT_AUDIO_LIMIT);
	return response;
}

/** Answers a single `bytes=` range from a full response, as <audio> expects. */
async function withRange(response: Response, range: string | null): Promise<Response> {
	if (!range) return response;
	const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
	const body = await response.blob();
	const size = body.size;
	let start = match?.[1] ? Number(match[1]) : NaN;
	let end = match?.[2] ? Number(match[2]) : size - 1;
	if (match && !match[1] && match[2]) {
		start = Math.max(0, size - Number(match[2]));
		end = size - 1;
	}
	if (!match || !Number.isInteger(start) || start > end || start >= size) {
		return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
	}
	end = Math.min(end, size - 1);
	return new Response(body.slice(start, end + 1), {
		status: 206,
		headers: {
			'content-type': response.headers.get('content-type') ?? 'application/octet-stream',
			'content-length': String(end - start + 1),
			'content-range': `bytes ${start}-${end}/${size}`,
			'accept-ranges': 'bytes'
		}
	});
}
