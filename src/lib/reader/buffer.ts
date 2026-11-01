/**
 * How much audio the player prepares, per device (localStorage), like the old app's buffer
 * settings. `ahead`: passages prepared in the background while one plays. `before`: how many of
 * those must be ready before a passage starts, at the start and whenever the voice catches up,
 * so a slow AllTalk gives one longer wait instead of a stop between every passage.
 */

export interface BufferSettings {
	ahead: number;
	before: number;
}

export const BUFFER_KEY = 'readhouse:buffer';
export const AHEAD_MIN = 1;
export const AHEAD_MAX = 10;
export const DEFAULT_BUFFER: BufferSettings = { ahead: 3, before: 0 };

function whole(value: unknown, min: number, max: number, fallback: number): number {
	return typeof value === 'number' && Number.isInteger(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

/** Brings any stored or chosen values into range; `before` never exceeds `ahead`. */
export function normalizeBuffer(value: Partial<BufferSettings> | null | undefined): BufferSettings {
	const ahead = whole(value?.ahead, AHEAD_MIN, AHEAD_MAX, DEFAULT_BUFFER.ahead);
	return { ahead, before: whole(value?.before, 0, ahead, DEFAULT_BUFFER.before) };
}

export function readBuffer(): BufferSettings {
	try {
		return normalizeBuffer(JSON.parse(localStorage.getItem(BUFFER_KEY) ?? 'null'));
	} catch {
		return DEFAULT_BUFFER;
	}
}

export function writeBuffer(settings: BufferSettings): BufferSettings {
	const normal = normalizeBuffer(settings);
	try {
		localStorage.setItem(BUFFER_KEY, JSON.stringify(normal));
	} catch {
		// Not remembered in private mode; the defaults apply next time.
	}
	return normal;
}
