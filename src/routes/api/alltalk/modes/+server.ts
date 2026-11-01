import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { AllTalkError } from '#lib/server/alltalk.js';
import { readJson } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

const ModesSchema = v.strictObject({
	lowVram: v.optional(v.boolean()),
	deepSpeed: v.optional(v.boolean())
});

/** Turns AllTalk's low VRAM mode or DeepSpeed on or off, where the engine supports them. */
export const POST: RequestHandler = async ({ request }) => {
	const modes = await readJson(request, ModesSchema, 1024);
	const { alltalk, forgetEngine } = app();
	try {
		const engine = await alltalk.engine();
		if (modes.lowVram !== undefined) {
			if (!engine.lowVram.capable) error(422, 'This engine has no low VRAM mode.');
			await alltalk.setLowVram(modes.lowVram);
			// Without CUDA, AllTalk unloads the model, turns the mode back off and reports success
			// anyway; load the model again so reading keeps working, and say why.
			if (modes.lowVram && !(await alltalk.engine()).lowVram.enabled && engine.model) {
				await alltalk.loadModel(engine.model);
				forgetEngine();
				error(
					422,
					'Low VRAM mode needs an NVIDIA graphics card (CUDA); AllTalk is running without one. The model was loaded again.'
				);
			}
		}
		if (modes.deepSpeed !== undefined) {
			if (!engine.deepSpeed.capable || !engine.deepSpeed.available) {
				error(422, 'DeepSpeed isn’t available with this engine or on this machine.');
			}
			await alltalk.setDeepSpeed(modes.deepSpeed);
		}
		forgetEngine();
		return json(await alltalk.engine());
	} catch (cause) {
		if (cause instanceof AllTalkError)
			error(cause.kind === 'unreachable' ? 503 : 502, cause.message);
		throw cause;
	}
};
