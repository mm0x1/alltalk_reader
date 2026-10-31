/** Request helpers: size-capped bodies and schema-validated JSON. */

import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const DEFAULT_JSON_LIMIT = 64 * 1024;

/** Reads the whole body, refusing anything over `maxBytes` (checked while streaming). */
export async function readBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
	const declared = Number(request.headers.get('content-length') ?? NaN);
	if (Number.isFinite(declared) && declared > maxBytes) tooLarge(maxBytes);
	if (!request.body) return new Uint8Array();

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > maxBytes) {
			await reader.cancel();
			tooLarge(maxBytes);
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

function tooLarge(maxBytes: number): never {
	error(413, `That is too large (the limit is ${Math.round(maxBytes / 1024 / 1024) || 1} MB).`);
}

/** Parses a JSON body against a schema; anything else is a 400 with a readable reason. */
export async function readJson<T extends v.GenericSchema>(
	request: Request,
	schema: T,
	maxBytes = DEFAULT_JSON_LIMIT
): Promise<v.InferOutput<T>> {
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		error(415, 'Expected JSON.');
	}
	const text = new TextDecoder().decode(await readBytes(request, maxBytes));
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		error(400, 'The request body is not valid JSON.');
	}
	const result = v.safeParse(schema, data);
	if (!result.success) {
		const issue = result.issues[0];
		const path = issue.path?.map((p) => p.key).join('.') ?? '';
		error(400, `Invalid request${path ? ` (${path})` : ''}: ${issue.message}`);
	}
	return result.output;
}

export const NO_STORE = { 'cache-control': 'no-store' } as const;
export const IMMUTABLE = { 'cache-control': 'private, max-age=31536000, immutable' } as const;
