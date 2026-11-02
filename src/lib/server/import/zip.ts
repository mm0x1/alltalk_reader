/**
 * Reads selected entries from a zip archive with hard limits, counted while inflating, so a
 * zip bomb or an archive with lying size headers is rejected before it can exhaust memory.
 */

import { Unzip, UnzipInflate, type UnzipFile } from 'fflate';

export interface ZipLimits {
	maxEntries: number;
	maxEntryBytes: number;
	maxTotalBytes: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
	maxEntries: 10_000,
	maxEntryBytes: 32 * 1024 * 1024,
	maxTotalBytes: 256 * 1024 * 1024
};

export class ZipLimitError extends Error {}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
	if (chunks.length === 1) return chunks[0];
	const out = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

/** Inflates the entries `wanted` accepts. Entries it rejects are skipped without inflating. */
export function readZip(
	bytes: Uint8Array,
	wanted: (name: string) => boolean,
	limits: ZipLimits = DEFAULT_ZIP_LIMITS
): Map<string, Uint8Array> {
	const entries = new Map<string, Uint8Array>();
	let count = 0;
	let total = 0;
	let failure: unknown = null;

	const unzip = new Unzip((file: UnzipFile) => {
		if (failure) return;
		if (++count > limits.maxEntries) {
			failure = new ZipLimitError(
				`This file holds more than ${limits.maxEntries.toLocaleString('en')} files, more than a book should.`
			);
			return;
		}
		if (!wanted(file.name)) return;
		const chunks: Uint8Array[] = [];
		let size = 0;
		file.ondata = (error, chunk, final) => {
			if (failure) return;
			if (error) {
				failure = error;
				file.terminate();
				return;
			}
			size += chunk.length;
			total += chunk.length;
			if (size > limits.maxEntryBytes || total > limits.maxTotalBytes) {
				failure = new ZipLimitError(
					'This file unpacks to more than a book should, so it was not opened.'
				);
				file.terminate();
				return;
			}
			chunks.push(chunk);
			if (final) entries.set(file.name, concat(chunks, size));
		};
		file.start();
	});
	unzip.register(UnzipInflate);
	unzip.push(bytes, true);
	if (failure) throw failure;
	return entries;
}
