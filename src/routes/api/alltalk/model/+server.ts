import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { AllTalkError } from '#lib/server/alltalk.js';
import { readJson } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

const ModelSchema = v.strictObject({ model: v.pipe(v.string(), v.minLength(1), v.maxLength(200)) });

/** Switches AllTalk to another model of its engine, one it lists itself (XTTS, APITTS...). */
export const POST: RequestHandler = async ({ request }) => {
	const { model } = await readJson(request, ModelSchema, 1024);
	const { alltalk, forgetEngine } = app();
	try {
		const engine = await alltalk.engine();
		if (!engine.models.includes(model)) error(422, 'AllTalk doesn’t offer that model.');
		await alltalk.loadModel(model);
		forgetEngine();
		return json(await alltalk.engine());
	} catch (cause) {
		if (cause instanceof AllTalkError)
			error(cause.kind === 'unreachable' ? 503 : 502, cause.message);
		throw cause;
	}
};
