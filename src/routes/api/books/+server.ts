import { error, json } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { readBytes } from '#lib/server/http.js';
import { importFile, ImportError } from '#lib/server/import/index.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(app().library.list());

/** Upload a book file as the raw request body; its name goes in `x-filename`. */
export const POST: RequestHandler = async ({ request }) => {
	const { config, library } = app();
	let filename = 'book';
	try {
		filename = decodeURIComponent(request.headers.get('x-filename') ?? 'book');
	} catch {
		// Keep the default name.
	}
	filename = filename.split(/[\\/]/).pop()!.slice(0, 255) || 'book';
	const bytes = await readBytes(request, config.uploadMaxBytes);
	try {
		const id = library.add(importFile(bytes, filename));
		return json({ id }, { status: 201 });
	} catch (cause) {
		if (cause instanceof ImportError) error(422, cause.message);
		throw cause;
	}
};
