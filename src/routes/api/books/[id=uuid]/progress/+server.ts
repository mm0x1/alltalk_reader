import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { readJson } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

const position = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000_000));
const ProgressSchema = v.strictObject({ chapter: position, block: position });

export const PUT: RequestHandler = async ({ params, request }) => {
	const { chapter, block } = await readJson(request, ProgressSchema, 1024);
	const result = app().library.saveProgress(params.id, chapter, block);
	if (result === 'no-book') error(404, 'No such book.');
	if (result === 'out-of-range') error(422, 'That place is not in this book.');
	return new Response(null, { status: 204 });
};
