/**
 * The reader's view of the Readhouse API.
 *
 * Every request carries a JSON content type, even without a body: body-less cross-origin
 * checks compare full origins, which breaks behind an HTTPS proxy like `tailscale serve`.
 */

import type { BookDetail, BookSummary, ChapterContent } from '#lib/library.js';
import type { VoiceSettings } from '#lib/settings.js';
import type { SpeechResult } from '#lib/speech.js';
import type { ServerStatus } from '#lib/status.js';

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' };

async function send<T>(
	method: string,
	path: string,
	body?: unknown,
	init: RequestInit = {}
): Promise<T> {
	const response = await fetch(path, {
		method,
		headers: JSON_HEADERS,
		body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
		...init
	});
	if (!response.ok) throw await toError(response);
	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

async function toError(response: Response): Promise<ApiError> {
	let message = response.statusText || 'Something went wrong.';
	try {
		const body = (await response.json()) as { message?: unknown };
		if (typeof body.message === 'string') message = body.message;
	} catch {
		// Not JSON; keep the status text.
	}
	return new ApiError(message, response.status);
}

export interface SpeechRequest {
	bookId: string;
	chapter: number;
	passage: number;
	/** The passage length the chapter's passages were built with. */
	chars: number;
	priority: 'now' | 'soon';
}

export const api = {
	status: (signal?: AbortSignal) => send<ServerStatus>('GET', '/api/status', undefined, { signal }),
	books: () => send<BookSummary[]>('GET', '/api/books'),
	book: (id: string) => send<BookDetail>('GET', `/api/books/${id}`),
	/** `chars` is part of the URL, so a cached chapter always carries matching passages. */
	chapter: (id: string, position: number, chars: number) =>
		send<ChapterContent>('GET', `/api/books/${id}/chapters/${position}?chars=${chars}`),
	paste: (text: string, title: string | null) =>
		send<{ id: string }>('POST', '/api/books/paste', { text, title }),
	rename: (id: string, title: string, author: string | null) =>
		send<void>('PATCH', `/api/books/${id}`, { title, author }),
	remove: (id: string) => send<void>('DELETE', `/api/books/${id}`),
	/** `keepalive` lets the request finish while the page is being hidden or closed. */
	saveProgress: (id: string, chapter: number, block: number, keepalive = false) =>
		send<void>('PUT', `/api/books/${id}/progress`, { chapter, block }, { keepalive }),
	voice: () => send<VoiceSettings>('GET', '/api/settings/voice'),
	saveVoice: (settings: VoiceSettings) =>
		send<VoiceSettings>('PUT', '/api/settings/voice', settings),
	speech: (request: SpeechRequest, signal?: AbortSignal) =>
		send<SpeechResult>('POST', '/api/speech', request, { signal }),
	stopSpeech: () => send<void>('POST', '/api/speech/stop'),
	unlock: (passcode: string) => send<void>('POST', '/api/unlock', { passcode }),
	lock: () => send<void>('POST', '/api/lock'),

	/** Uploads a book file as the raw body. */
	async upload(file: File): Promise<{ id: string }> {
		const response = await fetch('/api/books', {
			method: 'POST',
			headers: {
				'content-type': 'application/octet-stream',
				accept: 'application/json',
				'x-filename': encodeURIComponent(file.name)
			},
			body: file
		});
		if (!response.ok) throw await toError(response);
		return (await response.json()) as { id: string };
	}
};
