/**
 * Optional audio compression with ffmpeg: AllTalk's WAV becomes mono AAC (M4A) at 48 kbps,
 * about eight times smaller, which matters for phones on mobile data and for audio saved for
 * offline listening. AAC in M4A plays in every current browser, Safari included.
 *
 * ffmpeg is spawned with an argument list (no shell), on file paths Readhouse chose itself.
 */

import { spawn } from 'node:child_process';

const PROBE_TIMEOUT_MS = 5_000;
const TRANSCODE_TIMEOUT_MS = 120_000;

export interface Transcoder {
	readonly mime: string;
	transcode(input: string, output: string): Promise<void>;
}

function run(binary: string, args: string[], timeout: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(binary, args, {
			stdio: ['ignore', 'ignore', 'pipe'],
			timeout,
			killSignal: 'SIGKILL'
		});
		let stderr = '';
		child.stderr.on('data', (chunk: Buffer) => {
			stderr = (stderr + chunk.toString()).slice(-2000);
		});
		child.on('error', reject);
		child.on('close', (code, signal) => {
			if (code === 0) resolve();
			else reject(new Error(`${binary} failed (${signal ?? code}): ${stderr.trim().slice(-500)}`));
		});
	});
}

class FfmpegAac implements Transcoder {
	readonly mime = 'audio/mp4';

	constructor(private readonly binary: string) {}

	transcode(input: string, output: string): Promise<void> {
		return run(
			this.binary,
			[
				'-hide_banner',
				'-loglevel',
				'error',
				'-nostdin',
				'-y',
				'-i',
				input,
				'-vn',
				'-ac',
				'1',
				'-c:a',
				'aac',
				'-b:a',
				'48k',
				'-movflags',
				'+faststart',
				'-f',
				'mp4',
				output
			],
			TRANSCODE_TIMEOUT_MS
		);
	}
}

/** An AAC transcoder if `mode` allows it and ffmpeg is installed, otherwise null. */
export async function findTranscoder(
	mode: 'auto' | 'original',
	binary = 'ffmpeg'
): Promise<Transcoder | null> {
	if (mode === 'original') return null;
	try {
		await run(binary, ['-hide_banner', '-loglevel', 'error', '-version'], PROBE_TIMEOUT_MS);
		return new FfmpegAac(binary);
	} catch {
		return null;
	}
}
