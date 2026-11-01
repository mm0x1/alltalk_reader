import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { AllTalkError } from '#lib/server/alltalk.js';
import { readJson } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

/** How far preparing the whole book has got, or null when it isn't prepared. */
export const GET: RequestHandler = ({ params }) => {
	const { library, preparer } = app();
	if (!library.get(params.id)) error(404, 'No such book.');
	return json(preparer.status(params.id));
};

const ActionSchema = v.strictObject({
	action: v.picklist(['start', 'continue', 'stop', 'forget'])
});

/**
 * `start` prepares the book with the library's settings and AllTalk's model as they are now
 * (replacing an earlier preparation); `continue` resumes a paused one with its own settings;
 * `stop` pauses; `forget` returns the book to the library's settings.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const { action } = await readJson(request, ActionSchema, 256);
	const { library, preparer, settings, alltalk } = app();
	if (!library.get(params.id)) error(404, 'No such book.');
	if (action === 'start') {
		try {
			// Asked fresh, so the snapshot names the model AllTalk really has loaded.
			const engine = await alltalk.engine();
			preparer.start(params.id, settings.voice(), { engine: engine.engine, model: engine.model });
		} catch (cause) {
			if (cause instanceof AllTalkError) {
				error(503, 'AllTalk isn’t answering, so the book can’t be prepared now.');
			}
			throw cause;
		}
	} else if (action === 'continue') preparer.continue(params.id);
	else if (action === 'stop') preparer.stop(params.id);
	else preparer.forget(params.id);
	return json(preparer.status(params.id));
};
