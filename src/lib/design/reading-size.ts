/**
 * The per-device size of book text, kept in localStorage and applied as `data-reading-size` on
 * <html> (tokens.css scales `--text-reading` and the drop cap). Interface text keeps its sizes;
 * the system font size still scales everything.
 */

export const READING_SIZES = ['standard', 'large', 'larger'] as const;
export type ReadingSize = (typeof READING_SIZES)[number];
export const READING_SIZE_KEY = 'readhouse:reading-size';

export function readReadingSize(): ReadingSize {
	try {
		const stored = localStorage.getItem(READING_SIZE_KEY);
		return READING_SIZES.includes(stored as ReadingSize) ? (stored as ReadingSize) : 'standard';
	} catch {
		return 'standard';
	}
}

export function applyReadingSize(size: ReadingSize): void {
	if (size === 'standard') delete document.documentElement.dataset.readingSize;
	else document.documentElement.dataset.readingSize = size;
	try {
		localStorage.setItem(READING_SIZE_KEY, size);
	} catch {
		// Not remembered in private mode; still applied for this visit.
	}
}
