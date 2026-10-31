import { error } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { IMMUTABLE } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const cover = app().library.cover(params.id);
	if (!cover) error(404, 'No cover.');
	return new Response(cover.bytes as Uint8Array<ArrayBuffer>, {
		headers: {
			// The type was decided from the image bytes at import, never from the file.
			'content-type': cover.mime,
			'content-security-policy': "default-src 'none'; sandbox",
			...IMMUTABLE
		}
	});
};
