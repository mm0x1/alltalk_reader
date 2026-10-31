import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { app } from '#lib/server/app.js';
import { IMMUTABLE } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

/**
 * Serves cached audio. Supports single byte ranges, which Safari requires for media, and
 * conditional requests. The URL is a content hash, so it never changes meaning.
 */
export const GET: RequestHandler = ({ params, request }) => {
	const audio = app().speech.cached(params.hash);
	if (!audio) error(404, 'No such audio.');
	const etag = `"${params.hash}"`;
	const common = {
		'content-type': audio.mime,
		'accept-ranges': 'bytes',
		etag,
		...IMMUTABLE
	};
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers: common });
	}

	const size = audio.bytes;
	const range = request.headers.get('range');
	if (!range) {
		return new Response(Readable.toWeb(createReadStream(audio.path)) as ReadableStream, {
			headers: { ...common, 'content-length': String(size) }
		});
	}

	const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
	let start = match?.[1] ? Number(match[1]) : NaN;
	let end = match?.[2] ? Number(match[2]) : NaN;
	if (match && !match[1] && match[2]) {
		// "bytes=-500": the last 500 bytes.
		start = Math.max(0, size - Number(match[2]));
		end = size - 1;
	} else if (match && match[1] && !match[2]) {
		end = size - 1;
	}
	if (
		!match ||
		!Number.isInteger(start) ||
		!Number.isInteger(end) ||
		start > end ||
		start >= size
	) {
		return new Response(null, {
			status: 416,
			headers: { ...common, 'content-range': `bytes */${size}` }
		});
	}
	end = Math.min(end, size - 1);
	return new Response(
		Readable.toWeb(createReadStream(audio.path, { start, end })) as ReadableStream,
		{
			status: 206,
			headers: {
				...common,
				'content-length': String(end - start + 1),
				'content-range': `bytes ${start}-${end}/${size}`
			}
		}
	);
};
