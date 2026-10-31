import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { readJson } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

const RenameSchema = v.strictObject({
	title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
	author: v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(300)))
});

export const GET: RequestHandler = ({ params }) => {
	const book = app().library.get(params.id);
	if (!book) error(404, 'No such book.');
	return json(book);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { title, author } = await readJson(request, RenameSchema);
	if (!app().library.rename(params.id, title, author || null)) error(404, 'No such book.');
	return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = ({ params }) => {
	if (!app().library.remove(params.id)) error(404, 'No such book.');
	return new Response(null, { status: 204 });
};
