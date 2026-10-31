import { error, json } from '@sveltejs/kit';
import * as v from 'valibot';
import { splitIntoSegments } from '#lib/text/segments.js';
import { app } from '#lib/server/app.js';
import { AllTalkError } from '#lib/server/alltalk.js';
import { readJson } from '#lib/server/http.js';
import { SpeechCancelled } from '#lib/server/speech.js';
import type { SpeechResult } from '#lib/speech.js';
import type { RequestHandler } from './$types';

const index = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000_000));
const SpeechSchema = v.strictObject({
	bookId: v.pipe(v.string(), v.uuid()),
	chapter: index,
	block: index,
	segment: index,
	priority: v.picklist(['now', 'soon'])
});

/**
 * Makes sure the audio for one segment of one block exists, generating it if needed.
 * The text comes from the library, never from the request.
 */
export const POST: RequestHandler = async ({ request }) => {
	const input = await readJson(request, SpeechSchema, 1024);
	const { library, config, settings, speech } = app();

	const chapter = library.chapter(input.bookId, input.chapter);
	if (!chapter) error(404, 'No such chapter.');
	const block = chapter.blocks[input.block];
	if (!block || block.type === 'break') error(422, 'Nothing to read there.');
	const segments = splitIntoSegments(block.text, config.segmentMaxChars);
	const text = segments[input.segment];
	if (text === undefined) error(422, 'Nothing to read there.');

	try {
		const hash = await speech.speak(text, settings.voice(), input.priority, request.signal);
		return json({ audio: `/api/audio/${hash}`, segments: segments.length } satisfies SpeechResult);
	} catch (cause) {
		if (cause instanceof SpeechCancelled) error(409, 'Cancelled.');
		if (cause instanceof AllTalkError) {
			error(cause.kind === 'unreachable' ? 503 : 502, cause.message);
		}
		throw cause;
	}
};
