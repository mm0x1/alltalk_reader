import { error, json } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { IMMUTABLE } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

/** Chapter text never changes after import, so it can be cached indefinitely (and offline). */
export const GET: RequestHandler = ({ params }) => {
	const chapter = app().library.chapter(params.id, params.position);
	if (!chapter) error(404, 'No such chapter.');
	return json(chapter, { headers: IMMUTABLE });
};
