import { error, json } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { IMMUTABLE } from '#lib/server/http.js';
import { PASSAGE_MAX_CHARS, PASSAGE_MIN_CHARS } from '#lib/text/passages.js';
import type { RequestHandler } from './$types';

/**
 * A chapter with its passages for `?chars=` (the library's passage length when absent). Chapter
 * text never changes after import and the passages follow from it and `chars`, which is in the
 * URL, so the response can be cached indefinitely (and offline).
 */
export const GET: RequestHandler = ({ params, url }) => {
	const { library, settings } = app();
	const asked = url.searchParams.get('chars');
	const chars = asked === null ? settings.voice().passageChars : Number(asked);
	if (!Number.isInteger(chars) || chars < PASSAGE_MIN_CHARS || chars > PASSAGE_MAX_CHARS) {
		error(400, `chars must be a whole number from ${PASSAGE_MIN_CHARS} to ${PASSAGE_MAX_CHARS}.`);
	}
	const chapter = library.chapter(params.id, params.position, chars);
	if (!chapter) error(404, 'No such chapter.');
	return json(chapter, { headers: asked === null ? undefined : IMMUTABLE });
};
