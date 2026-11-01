/** Server-side storage of the voice settings. */

import * as v from 'valibot';
import {
	applicable,
	DEFAULT_VOICE_SETTINGS,
	VoiceSettingsSchema,
	type VoiceSettings
} from '#lib/settings.js';
import type { Database } from './db.js';

export class SettingsStore {
	constructor(private readonly db: Database) {}

	/**
	 * The stored settings, with defaults for anything missing or no longer valid, so an older
	 * or damaged record never stops playback.
	 */
	voice(): VoiceSettings {
		const row = this.db.statement(`SELECT data FROM settings WHERE id = 1`).get() as
			{ data: string } | undefined;
		if (!row) return { ...DEFAULT_VOICE_SETTINGS };
		let stored: Record<string, unknown>;
		try {
			const parsed: unknown = JSON.parse(row.data);
			stored = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
		} catch {
			stored = {};
		}
		const merged: Record<string, unknown> = { ...DEFAULT_VOICE_SETTINGS };
		for (const key of Object.keys(DEFAULT_VOICE_SETTINGS) as (keyof VoiceSettings)[]) {
			const candidate = { ...DEFAULT_VOICE_SETTINGS, [key]: stored[key] };
			if (v.safeParse(VoiceSettingsSchema, candidate).success) merged[key] = stored[key];
		}
		return applicable(v.parse(VoiceSettingsSchema, merged));
	}

	saveVoice(settings: VoiceSettings): VoiceSettings {
		const valid = applicable(v.parse(VoiceSettingsSchema, settings));
		this.db
			.statement(
				`INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET data = excluded.data`
			)
			.run(JSON.stringify(valid));
		return valid;
	}
}
