import { defineEnvVars } from '@sveltejs/kit/env';

function integer(name: string, fallback: number, min: number, max: number) {
	return (value: string | undefined) => {
		if (value === undefined || value === '') return fallback;
		const number = Number(value);
		if (!Number.isInteger(number) || number < min || number > max) {
			throw new Error(`${name} must be a whole number from ${min} to ${max}, got "${value}"`);
		}
		return number;
	};
}

export const variables = defineEnvVars({
	ALLTALK_URL: {
		description: 'Base URL of the AllTalk v2 server, as seen from this machine.',
		schema: (value) => {
			const url = new URL(value || 'http://127.0.0.1:7851');
			if (url.protocol !== 'http:' && url.protocol !== 'https:') {
				throw new Error('ALLTALK_URL must be an http(s) URL');
			}
			return url.origin;
		}
	},
	DATA_DIR: {
		description: 'Directory for the library database and generated audio.',
		schema: (value) => value || 'data'
	},
	ACCESS_PASSCODE: {
		description: 'Optional passcode required to open Readhouse from another device.',
		schema: (value) => {
			if (!value) return undefined;
			if (value.length < 6) throw new Error('ACCESS_PASSCODE must be at least 6 characters');
			return value;
		}
	},
	SEGMENT_MAX_CHARS: {
		description: 'Longest text sent to AllTalk in one request.',
		schema: integer('SEGMENT_MAX_CHARS', 500, 100, 2000)
	},
	AUDIO_CACHE_MAX_MB: {
		description: 'Disk space generated audio may use before the least recently played is removed.',
		schema: integer('AUDIO_CACHE_MAX_MB', 2048, 64, 1_000_000)
	},
	AUDIO_FORMAT: {
		description:
			'"auto" compresses audio to AAC when ffmpeg is installed (about 8x smaller); "original" keeps AllTalk\'s files.',
		schema: (value) => {
			const mode = value || 'auto';
			if (mode !== 'auto' && mode !== 'original') {
				throw new Error('AUDIO_FORMAT must be "auto" or "original"');
			}
			return mode as 'auto' | 'original';
		}
	},
	UPLOAD_MAX_MB: {
		description: 'Largest book file that can be imported.',
		schema: integer('UPLOAD_MAX_MB', 64, 1, 1024)
	}
});
