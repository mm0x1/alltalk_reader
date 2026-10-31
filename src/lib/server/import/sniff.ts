/** File type detection from content (magic bytes), never from names or client headers. */

import type { CoverMime } from '#lib/book.js';

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
	if (bytes.length < offset + signature.length) return false;
	return signature.every((byte, i) => bytes[offset + i] === byte);
}

export function sniffImage(bytes: Uint8Array): CoverMime | null {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return 'image/webp';
	}
	return null;
}

export function isZip(bytes: Uint8Array): boolean {
	return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
}

/** True when the bytes look like binary data rather than text in any common encoding. */
export function looksBinary(bytes: Uint8Array): boolean {
	if (startsWith(bytes, [0xff, 0xfe]) || startsWith(bytes, [0xfe, 0xff])) return false;
	const sample = bytes.subarray(0, 8192);
	let suspicious = 0;
	for (const byte of sample) {
		if (byte === 0) return true;
		if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) suspicious++;
	}
	return suspicious > sample.length * 0.02;
}
