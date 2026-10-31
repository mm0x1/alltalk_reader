import { json } from '@sveltejs/kit';
import { VoiceSettingsSchema } from '#lib/settings.js';
import { app } from '#lib/server/app.js';
import { readJson } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(app().settings.voice());

export const PUT: RequestHandler = async ({ request }) => {
	const settings = await readJson(request, VoiceSettingsSchema, 4096);
	return json(app().settings.saveVoice(settings));
};
