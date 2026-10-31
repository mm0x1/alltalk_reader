/** Picks up what the service worker kept from a share to Readhouse (see SHARE_CACHE). */

import { SHARE_CACHE, SHARE_KEY } from '#lib/offline-shared.js';

export type Shared =
	| { kind: 'file'; file: File }
	| { kind: 'text'; title: string; text: string }
	| { kind: 'link'; url: string };

const LINK = /^https?:\/\/\S+$/;

/** Takes the shared item (once: it is removed), or null when there is none. */
export async function takeShared(): Promise<Shared | null> {
	if (!('caches' in globalThis)) return null;
	const cache = await caches.open(SHARE_CACHE);
	const response = await cache.match(SHARE_KEY);
	if (!response) return null;
	await cache.delete(SHARE_KEY);

	const name = response.headers.get('x-file-name');
	if (name !== null) {
		const blob = await response.blob();
		return { kind: 'file', file: new File([blob], decodeURIComponent(name), { type: blob.type }) };
	}
	const { title = '', text = '', url = '' } = (await response.json()) as Record<string, string>;
	// Apps share a page as its address, often inside the text; a link alone can't become a book.
	const body = text.trim();
	if (!body || LINK.test(body)) {
		const link = url.trim() || body;
		return link ? { kind: 'link', url: link } : null;
	}
	return { kind: 'text', title: title.trim(), text: body };
}
