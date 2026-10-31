/**
 * The listening session: one player for the whole app, so audio keeps going while browsing the
 * library. Browser only; the server never creates a player.
 */

import type { BookDetail, ChapterContent } from '#lib/library.js';
import { Player } from './player.svelte.js';
import type { Position } from './position.js';

let current = $state<Player | null>(null);

export const session = {
	get player(): Player | null {
		return current;
	},

	/** The player for this book, reusing the running one if it is the same book. */
	open(book: BookDetail, maxChars: number, start: Position, chapter: ChapterContent): Player {
		if (current?.book.id === book.id) return current;
		current?.destroy();
		current = new Player(book, maxChars, start, chapter);
		return current;
	},

	close(): void {
		current?.destroy();
		current = null;
	}
};
