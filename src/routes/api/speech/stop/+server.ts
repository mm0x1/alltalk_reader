import { app } from '#lib/server/app.js';
import type { RequestHandler } from './$types';

/** Cancels queued speech and asks AllTalk to stop the generation in progress. */
export const POST: RequestHandler = async () => {
	await app().speech.stop();
	return new Response(null, { status: 204 });
};
