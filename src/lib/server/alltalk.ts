/**
 * Client for the AllTalk v2 API (`alltalkbeta` branch). Only the server talks to AllTalk; the
 * browser never does, so AllTalk can stay on localhost.
 *
 * URLs in AllTalk's responses are never followed: only the file name is taken from them and
 * fetched from the configured AllTalk origin, so a response can't redirect us elsewhere (SSRF).
 */

import * as v from 'valibot';
import type { VoiceSettings } from '#lib/settings.js';
import type { EngineSummary } from '#lib/status.js';

export type EngineInfo = EngineSummary;

const STATUS_TIMEOUT_MS = 4_000;
const GENERATE_TIMEOUT_MS = 180_000;
/** Loading a model or moving it between memories can take a while on a CPU. */
const RELOAD_TIMEOUT_MS = 300_000;
const AUDIO_FILE = /^[\w.-]{1,200}\.(?:wav|mp3|opus|aac|flac|ogg|m4a)$/;

const CurrentSettingsSchema = v.looseObject({
	current_engine_loaded: v.optional(v.nullable(v.string()), null),
	current_model_loaded: v.optional(v.nullable(v.string()), null),
	models_available: v.optional(v.array(v.looseObject({ name: v.string() })), []),
	lowvram_capable: v.optional(v.boolean(), false),
	lowvram_enabled: v.optional(v.boolean(), false),
	deepspeed_capable: v.optional(v.boolean(), false),
	deepspeed_available: v.optional(v.boolean(), false),
	deepspeed_enabled: v.optional(v.boolean(), false),
	audio_format: v.optional(v.nullable(v.string()), null),
	multivoice_capable: v.optional(v.boolean(), false),
	streaming_capable: v.optional(v.boolean(), false),
	temperature_capable: v.optional(v.boolean(), false),
	repetitionpenalty_capable: v.optional(v.boolean(), false),
	languages_capable: v.optional(v.boolean(), false),
	generationspeed_capable: v.optional(v.boolean(), false),
	pitch_capable: v.optional(v.boolean(), false)
});

const VoicesSchema = v.object({
	status: v.string(),
	voices: v.optional(v.array(v.string()), [])
});
const RvcVoicesSchema = v.object({
	status: v.string(),
	rvcvoices: v.optional(v.array(v.string()), [])
});
const GenerateSchema = v.object({
	status: v.literal('generate-success'),
	output_file_url: v.string()
});
/** AllTalk's switches answer 200 with a status word; anything but success is a refusal. */
const StatusSchema = v.looseObject({
	status: v.string(),
	message: v.optional(v.string(), '')
});

export class AllTalkError extends Error {
	constructor(
		message: string,
		readonly kind: 'unreachable' | 'rejected' | 'invalid-response'
	) {
		super(message);
	}
}

export type Fetch = typeof fetch;

export class AllTalk {
	constructor(
		readonly origin: string,
		private readonly fetch: Fetch = globalThis.fetch
	) {}

	async #request(path: string, init: RequestInit & { timeout: number }): Promise<Response> {
		const signal = init.signal
			? AbortSignal.any([init.signal, AbortSignal.timeout(init.timeout)])
			: AbortSignal.timeout(init.timeout);
		let response: Response;
		try {
			response = await this.fetch(new URL(path, this.origin), {
				...init,
				signal,
				redirect: 'error'
			});
		} catch (error) {
			if (init.signal?.aborted) throw error;
			throw new AllTalkError(`AllTalk did not answer at ${this.origin}`, 'unreachable');
		}
		return response;
	}

	async #json<T>(schema: v.GenericSchema<unknown, T>, response: Response): Promise<T> {
		try {
			return v.parse(schema, await response.json());
		} catch {
			throw new AllTalkError(
				'AllTalk sent a response Readhouse does not understand',
				'invalid-response'
			);
		}
	}

	/** True once AllTalk has loaded its engine. */
	async ready(signal?: AbortSignal): Promise<boolean> {
		const response = await this.#request('/api/ready', { timeout: STATUS_TIMEOUT_MS, signal });
		return response.ok && (await response.text()).trim() === 'Ready';
	}

	async engine(signal?: AbortSignal): Promise<EngineInfo> {
		const response = await this.#request('/api/currentsettings', {
			timeout: STATUS_TIMEOUT_MS,
			signal
		});
		if (!response.ok) throw new AllTalkError('AllTalk could not report its settings', 'rejected');
		const s = await this.#json(CurrentSettingsSchema, response);
		return {
			engine: s.current_engine_loaded,
			model: s.current_model_loaded,
			models: s.models_available.map((model) => model.name),
			audioFormat: s.audio_format,
			capabilities: {
				multivoice: s.multivoice_capable,
				streaming: s.streaming_capable,
				temperature: s.temperature_capable,
				repetitionPenalty: s.repetitionpenalty_capable,
				languages: s.languages_capable,
				pitch: s.pitch_capable
			},
			lowVram: { capable: s.lowvram_capable, enabled: s.lowvram_enabled },
			deepSpeed: {
				capable: s.deepspeed_capable,
				available: s.deepspeed_available,
				enabled: s.deepspeed_enabled
			}
		};
	}

	/** Voices of the loaded engine; empty when the engine has only one voice. */
	async voices(signal?: AbortSignal): Promise<string[]> {
		const response = await this.#request('/api/voices', { timeout: STATUS_TIMEOUT_MS, signal });
		if (!response.ok) return [];
		const body = await this.#json(VoicesSchema, response);
		return body.status === 'success' ? body.voices : [];
	}

	async rvcVoices(signal?: AbortSignal): Promise<string[]> {
		const response = await this.#request('/api/rvcvoices', { timeout: STATUS_TIMEOUT_MS, signal });
		if (!response.ok) return [];
		const body = await this.#json(RvcVoicesSchema, response);
		return body.status === 'success' ? body.rvcvoices : [];
	}

	/** Generates speech and returns the name of the file AllTalk wrote. */
	async generate(text: string, settings: VoiceSettings, signal?: AbortSignal): Promise<string> {
		const form = new URLSearchParams({
			text_input: text,
			text_filtering: 'standard',
			narrator_enabled: settings.narratorEnabled ? 'true' : 'false',
			text_not_inside: settings.unquotedIs,
			language: settings.language,
			output_file_name: 'readhouse',
			output_file_timestamp: 'true',
			autoplay: 'false',
			rvccharacter_voice_gen: settings.rvcVoice,
			rvccharacter_pitch: String(settings.rvcPitch)
		});
		if (settings.voice) form.set('character_voice_gen', settings.voice);
		if (settings.narratorEnabled && settings.narratorVoice) {
			form.set('narrator_voice_gen', settings.narratorVoice);
		}
		if (settings.narratorEnabled) {
			form.set('rvcnarrator_voice_gen', settings.rvcNarratorVoice);
			form.set('rvcnarrator_pitch', String(settings.rvcNarratorPitch));
		}
		if (settings.pitch !== 0) form.set('pitch', String(settings.pitch));
		if (settings.temperature !== null) form.set('temperature', String(settings.temperature));
		if (settings.repetitionPenalty !== null) {
			form.set('repetition_penalty', String(settings.repetitionPenalty));
		}

		const response = await this.#request('/api/tts-generate', {
			method: 'POST',
			body: form,
			timeout: GENERATE_TIMEOUT_MS,
			signal
		});
		if (!response.ok) {
			const detail = await response.text().catch(() => '');
			throw new AllTalkError(
				`AllTalk could not generate speech (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`,
				'rejected'
			);
		}
		const body = await this.#json(GenerateSchema, response);
		const file = body.output_file_url.split('/').pop() ?? '';
		if (!AUDIO_FILE.test(file)) {
			throw new AllTalkError('AllTalk returned an unexpected file name', 'invalid-response');
		}
		return file;
	}

	/** Fetches a generated file by name from AllTalk's audio folder. */
	async audio(file: string, signal?: AbortSignal): Promise<Response> {
		if (!AUDIO_FILE.test(file))
			throw new AllTalkError('Invalid audio file name', 'invalid-response');
		const response = await this.#request(`/audio/${encodeURIComponent(file)}`, {
			timeout: GENERATE_TIMEOUT_MS,
			signal
		});
		if (!response.ok || !response.body) {
			throw new AllTalkError(`AllTalk could not send the audio (${response.status})`, 'rejected');
		}
		return response;
	}

	/** Sends one of AllTalk's switches and checks its status word. */
	async #switch(path: string, success: string, what: string): Promise<void> {
		const response = await this.#request(path, { method: 'POST', timeout: RELOAD_TIMEOUT_MS });
		if (!response.ok)
			throw new AllTalkError(`AllTalk could not ${what} (${response.status})`, 'rejected');
		const body = await this.#json(StatusSchema, response);
		if (body.status === success || body.status === 'success') return;
		const detail = body.message || body.status;
		throw new AllTalkError(`AllTalk could not ${what}: ${detail.slice(0, 200)}`, 'rejected');
	}

	/** Loads another model of the current engine (e.g. APITTS instead of XTTS). */
	async loadModel(model: string): Promise<void> {
		const query = new URLSearchParams({ tts_method: model });
		await this.#switch(`/api/reload?${query}`, 'model-success', 'switch the model');
	}

	async setLowVram(enabled: boolean): Promise<void> {
		const query = new URLSearchParams({ new_low_vram_value: String(enabled) });
		await this.#switch(`/api/lowvramsetting?${query}`, 'lowvram-success', 'change low VRAM mode');
	}

	async setDeepSpeed(enabled: boolean): Promise<void> {
		const query = new URLSearchParams({ new_deepspeed_value: String(enabled) });
		await this.#switch(`/api/deepspeed?${query}`, 'deepspeed-success', 'change DeepSpeed');
	}

	/** Asks AllTalk to stop the generation in progress, if any. */
	async stop(): Promise<void> {
		await this.#request('/api/stop-generation', {
			method: 'PUT',
			timeout: STATUS_TIMEOUT_MS
		}).catch(() => undefined);
	}
}
