/**
 * Voice settings: how AllTalk reads. Stored on the server (they decide which audio is cached)
 * and shared by every device. Per-device preferences such as theme live in the browser.
 */

import * as v from 'valibot';
import { DEFAULT_PASSAGE_CHARS, PASSAGE_MAX_CHARS, PASSAGE_MIN_CHARS } from './text/passages.js';

/** Languages AllTalk v2 accepts (`auto` detects per request). */
export const LANGUAGES = [
	'auto',
	'en',
	'ar',
	'cs',
	'de',
	'es',
	'fr',
	'hi',
	'hu',
	'it',
	'ja',
	'ko',
	'nl',
	'pl',
	'pt',
	'ru',
	'tr',
	'zh-cn'
] as const;

/** Same rule as AllTalk's own check; empty means "AllTalk's default voice". */
const voiceName = v.pipe(v.string(), v.maxLength(200), v.regex(/^[^<>"|?*]*$/));

export const VoiceSettingsSchema = v.strictObject({
	voice: voiceName,
	narratorEnabled: v.boolean(),
	narratorVoice: voiceName,
	/** Who reads text outside quotes when the narrator is on ("silent" skips it). */
	unquotedIs: v.picklist(['narrator', 'character', 'silent']),
	language: v.picklist(LANGUAGES),
	/** Null leaves the engine's own setting in place. */
	temperature: v.nullable(v.pipe(v.number(), v.minValue(0.1), v.maxValue(1))),
	repetitionPenalty: v.nullable(v.pipe(v.number(), v.minValue(1), v.maxValue(20))),
	rvcVoice: v.pipe(v.string(), v.maxLength(300), v.regex(/^(?:Disabled|[^<>"|?*]+\.pth)$/)),
	rvcPitch: v.pipe(v.number(), v.integer(), v.minValue(-24), v.maxValue(24)),
	/** RVC for the narrator's voice, when the narrator is on. */
	rvcNarratorVoice: v.pipe(v.string(), v.maxLength(300), v.regex(/^(?:Disabled|[^<>"|?*]+\.pth)$/)),
	rvcNarratorPitch: v.pipe(v.number(), v.integer(), v.minValue(-24), v.maxValue(24)),
	/** Generated pitch, for engines that support it (XTTS doesn't). */
	pitch: v.pipe(v.number(), v.integer(), v.minValue(-10), v.maxValue(10)),
	/** How long a passage (one request to AllTalk) may be, in characters. */
	passageChars: v.pipe(
		v.number(),
		v.integer(),
		v.minValue(PASSAGE_MIN_CHARS),
		v.maxValue(PASSAGE_MAX_CHARS)
	)
});

export type VoiceSettings = v.InferOutput<typeof VoiceSettingsSchema>;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
	voice: '',
	narratorEnabled: false,
	narratorVoice: '',
	unquotedIs: 'narrator',
	language: 'en',
	temperature: null,
	repetitionPenalty: null,
	rvcVoice: 'Disabled',
	rvcPitch: 0,
	rvcNarratorVoice: 'Disabled',
	rvcNarratorPitch: 0,
	pitch: 0,
	passageChars: DEFAULT_PASSAGE_CHARS
};
