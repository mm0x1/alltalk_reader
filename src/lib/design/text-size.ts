/**
 * The per-device text size, kept in localStorage and applied as `data-text-size` on <html>.
 * Everything is sized in rem, so it scales the whole app (on top of the system's text size).
 */

export const TEXT_SIZES = ['tiny', 'small', 'medium', 'large', 'extra-large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SIZE_KEY = 'readhouse:text-size';
/** The earlier three-step reading text size, carried over once. */
const LEGACY_KEY = 'readhouse:reading-size';
const LEGACY: Record<string, TextSize> = { large: 'large', larger: 'extra-large' };

export const textSizeLabel = (size: TextSize): string =>
	size === 'extra-large' ? 'Extra large' : size[0].toUpperCase() + size.slice(1);

export function readTextSize(): TextSize {
	try {
		const stored = localStorage.getItem(TEXT_SIZE_KEY);
		if (TEXT_SIZES.includes(stored as TextSize)) return stored as TextSize;
		return LEGACY[localStorage.getItem(LEGACY_KEY) ?? ''] ?? 'medium';
	} catch {
		return 'medium';
	}
}

export function applyTextSize(size: TextSize): void {
	if (size === 'medium') delete document.documentElement.dataset.textSize;
	else document.documentElement.dataset.textSize = size;
	try {
		localStorage.setItem(TEXT_SIZE_KEY, size);
		localStorage.removeItem(LEGACY_KEY);
	} catch {
		// Not remembered in private mode; still applied for this visit.
	}
}
