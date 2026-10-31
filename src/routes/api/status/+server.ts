import { json } from '@sveltejs/kit';
import { app } from '#lib/server/app.js';
import { AllTalkError } from '#lib/server/alltalk.js';
import type { ServerStatus } from '#lib/status.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const { alltalk, engineInfo, config, speech } = app();
	let status: ServerStatus['alltalk'];
	try {
		const [ready, engine, voices, rvcVoices] = await Promise.all([
			alltalk.ready(),
			engineInfo(),
			alltalk.voices(),
			alltalk.rvcVoices()
		]);
		status = { reachable: true, ready, engine, voices, rvcVoices };
	} catch (error) {
		if (!(error instanceof AllTalkError)) throw error;
		status = { reachable: false, ready: false, engine: null, voices: [], rvcVoices: [] };
	}
	return json({
		alltalk: status,
		segmentMaxChars: config.segmentMaxChars,
		uploadMaxBytes: config.uploadMaxBytes,
		pending: speech.pending
	} satisfies ServerStatus);
};
