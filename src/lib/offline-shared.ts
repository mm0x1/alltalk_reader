/** Names shared by the service worker and the page for offline storage. */

/** Audio cached as it is listened to; bounded, oldest removed first. */
export const RECENT_AUDIO_CACHE = 'readhouse-audio-recent-v1';
/** Audio saved on purpose for offline listening; only removed by the reader. */
export const SAVED_AUDIO_CACHE = 'readhouse-audio-saved-v1';
/** Chapter text and covers; immutable, small. */
export const BOOK_CACHE = 'readhouse-books-v1';
/** Pages and their data, for opening a book again without a connection. */
export const PAGE_CACHE = 'readhouse-pages-v1';

/** Request header marking an audio fetch as "save for offline". */
export const SAVE_HEADER = 'x-readhouse-save';

export const RECENT_AUDIO_LIMIT = 400;
export const PAGE_LIMIT = 40;
