/**
 * Compression for dynamic text responses (pages, page data, JSON). adapter-node serves the built
 * assets precompressed but sends everything rendered on request as is, and a long chapter's page
 * is hundreds of kilobytes of text: a few times smaller compressed, which counts over Tailscale on
 * a phone's mobile data. Audio is already compressed and is never touched.
 */

import { pipeline, Readable, type Transform } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';

/** Below this, compressing saves less than it costs. */
const MIN_BYTES = 1024;
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|manifest\+json|xml)\b)/;

type Encoding = 'br' | 'gzip';

/** The best encoding the client accepts: brotli, then gzip (`q=0` means refused). */
export function pickEncoding(acceptEncoding: string | null): Encoding | null {
	if (!acceptEncoding) return null;
	const accepted = new Set<string>();
	for (const part of acceptEncoding.toLowerCase().split(',')) {
		const [name, ...params] = part.trim().split(';');
		const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
		if (q && Number(q.slice(2)) === 0) continue;
		accepted.add(name.trim());
	}
	if (accepted.has('br')) return 'br';
	if (accepted.has('gzip')) return 'gzip';
	return null;
}

function compressor(encoding: Encoding): Transform {
	// Fast settings, flushed after every chunk so a streamed page still arrives as it is made.
	return encoding === 'br'
		? createBrotliCompress({
				flush: constants.BROTLI_OPERATION_FLUSH,
				params: { [constants.BROTLI_PARAM_QUALITY]: 4 }
			})
		: createGzip({ flush: constants.Z_SYNC_FLUSH });
}

/** Returns the response compressed when it is worth it and the client accepts it. */
export function compress(request: Request, response: Response): Response {
	if (request.method === 'HEAD' || !response.body) return response;
	if (response.status === 206 || response.status === 204 || response.status === 304) {
		return response;
	}
	const headers = response.headers;
	if (headers.has('content-encoding') || headers.has('content-range')) return response;
	if (!COMPRESSIBLE.test(headers.get('content-type') ?? '')) return response;
	if (/\bno-transform\b/.test(headers.get('cache-control') ?? '')) return response;
	const length = Number(headers.get('content-length') ?? NaN);
	if (Number.isFinite(length) && length < MIN_BYTES) return response;
	const encoding = pickEncoding(request.headers.get('accept-encoding'));

	headers.append('vary', 'Accept-Encoding');
	if (!encoding) return response;

	const out = new Headers(headers);
	out.set('content-encoding', encoding);
	out.delete('content-length');
	const etag = out.get('etag');
	if (etag && !etag.startsWith('W/')) out.set('etag', `W/${etag}`);
	const body = compressor(encoding);
	// A failure on either side (a client hanging up) tears both down.
	pipeline(Readable.fromWeb(response.body as NodeReadableStream), body, () => {});
	return new Response(Readable.toWeb(body) as ReadableStream, {
		status: response.status,
		statusText: response.statusText,
		headers: out
	});
}
