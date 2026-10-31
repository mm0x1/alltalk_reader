import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { readJson } from '#lib/server/http.js';
import { importPaste, ImportError } from '#lib/server/import/index.js';
import type { RequestHandler } from './$types';

const MAX_TEXT = 5 * 1024 * 1024;

const PasteSchema = v.strictObject({
	title: v.nullish(v.pipe(v.string(), v.trim(), v.maxLength(300)), null),
	text: v.pipe(v.string(), v.minLength(1), v.maxLength(MAX_TEXT))
});

export const POST: RequestHandler = async ({ request }) => {
	const { title, text } = await readJson(request, PasteSchema, MAX_TEXT * 4 + 1024);
	try {
		const id = app().library.add(importPaste(text, title || null));
		return json({ id }, { status: 201 });
	} catch (cause) {
		if (cause instanceof ImportError) error(422, cause.message);
		throw cause;
	}
};
