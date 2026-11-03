import { error, json } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { NO_STORE } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

/** Longer than any phrase worth looking for. */
const QUERY_MAX_CHARS = 200;
/** Places returned at most; the reader adds a word to narrow a longer list. */
const HITS_MAX = 50;

/** Places in the book where `?q=` appears. */
export const GET: RequestHandler = ({ params, url }) => {
	const query = url.searchParams.get('q') ?? '';
	if (query.length > QUERY_MAX_CHARS) {
		error(400, `Search for at most ${QUERY_MAX_CHARS} characters.`);
	}
	const results = app().library.search(params.id, query, HITS_MAX);
	if (!results) error(404, 'No such book.');
	return json(results, { headers: NO_STORE });
};
