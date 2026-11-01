import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { AllTalkError } from '#lib/server/alltalk.js';
import { readJson } from '#lib/server/http.js';
import { VoiceSettingsSchema } from '#lib/settings.js';
import type { RequestHandler } from './$types';

const { voice, rvcVoice, rvcPitch } = VoiceSettingsSchema.entries;
const PreviewSchema = v.strictObject({ voice, rvcVoice, rvcPitch });

/**
 * A short sample of a voice, so it can be heard before it is chosen. Made with the ordinary
 * generation call and the library's other voice settings, so it sounds like the reading will.
 * (AllTalk's own preview endpoint fails with APITTS models.) Streamed through, not kept.
 */
export const POST: RequestHandler = async ({ request }) => {
	const input = await readJson(request, PreviewSchema, 1024);
	const { alltalk, settings } = app();
	try {
		const voices = await alltalk.voices();
		if (!input.voice || !voices.includes(input.voice)) error(422, 'AllTalk has no such voice.');
		const name = input.voice.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ');
		const file = await alltalk.generate(
			`Hello, this is ${name}. It was a bright cold day in April.`,
			{ ...settings.voice(), ...input, narratorEnabled: false },
			request.signal
		);
		const audio = await alltalk.audio(file, request.signal);
		// Only ever an audio type, whatever AllTalk says, so the response can't be a page.
		const type = audio.headers.get('content-type') ?? '';
		return new Response(audio.body, {
			headers: {
				'content-type': /^audio\/[\w.+-]+$/.test(type) ? type : 'audio/wav',
				'cache-control': 'no-store'
			}
		});
	} catch (cause) {
		if (cause instanceof AllTalkError)
			error(cause.kind === 'unreachable' ? 503 : 502, cause.message);
		throw cause;
	}
};
