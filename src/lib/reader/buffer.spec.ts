import { describe, expect, it } from 'vitest';
import { DEFAULT_BUFFER, normalizeBuffer } from './buffer.js';

describe('normalizeBuffer', () => {
	it('falls back to the defaults for nothing or nonsense', () => {
		expect(normalizeBuffer(null)).toEqual(DEFAULT_BUFFER);
		expect(normalizeBuffer({ ahead: 'lots' as unknown as number, before: 1.5 })).toEqual(
			DEFAULT_BUFFER
		);
	});

	it('keeps values in range, and never waits for more than it prepares', () => {
		expect(normalizeBuffer({ ahead: 50, before: 2 })).toEqual({ ahead: 10, before: 2 });
		expect(normalizeBuffer({ ahead: 0, before: 0 })).toEqual({ ahead: 1, before: 0 });
		expect(normalizeBuffer({ ahead: 2, before: 5 })).toEqual({ ahead: 2, before: 2 });
	});
});
