/**
 * A stand-in for the AllTalk v2 API: same endpoints and response shapes, instant (or
 * deliberately slow) short WAV files, and switches for failure. Lets tests and local UI work
 * run without a GPU.
 *
 * Run standalone: `node tests/fake-alltalk.ts [port]`.
 */

import { createServer, type IncomingMessage, type Server } from 'node:http';

export interface FakeAllTalkOptions {
	port?: number;
	/** Delay before each generation answers. */
	delayMs?: number;
	voices?: string[];
	/** Shortest passage, in seconds: long passages keep a "playing" screen still for screenshots. */
	minSeconds?: number;
	/** Seconds per character: 0.01 by default, so tests move fast; about 0.065 is speaking pace. */
	secondsPerChar?: number;
}

export interface FakeAllTalk {
	url: string;
	/** Text of every generation request, in order. */
	generated: string[];
	/** Last form submitted to /api/tts-generate. */
	lastForm: URLSearchParams | null;
	stops: number;
	setDelay(ms: number): void;
	setFailing(failing: boolean): void;
	setReady(ready: boolean): void;
	close(): Promise<void>;
}

/** A mono 16-bit PCM WAV of silence: 0.5 s plus 10 ms per character, so tests can observe each passage. */
export function silentWav(text: string, minSeconds = 0, secondsPerChar = 0.01): Buffer {
	const sampleRate = 8000;
	const seconds = Math.max(minSeconds, 0.5 + Math.min(text.length, 2000) * secondsPerChar);
	const samples = Math.round(sampleRate * seconds);
	const data = samples * 2;
	const wav = Buffer.alloc(44 + data);
	wav.write('RIFF', 0);
	wav.writeUInt32LE(36 + data, 4);
	wav.write('WAVE', 8);
	wav.write('fmt ', 12);
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(1, 22);
	wav.writeUInt32LE(sampleRate, 24);
	wav.writeUInt32LE(sampleRate * 2, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write('data', 36);
	wav.writeUInt32LE(data, 40);
	return wav;
}

async function readBody(request: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

export async function startFakeAllTalk(options: FakeAllTalkOptions = {}): Promise<FakeAllTalk> {
	let delay = options.delayMs ?? 0;
	let failing = false;
	let ready = true;
	const files = new Map<string, Buffer>();
	const voices = options.voices ?? ['female_01.wav', 'male_01.wav', 'narrator.wav'];
	let counter = 0;

	const state = {
		generated: [] as string[],
		lastForm: null as URLSearchParams | null,
		stops: 0
	};

	const server: Server = createServer(async (request, response) => {
		const url = new URL(request.url ?? '/', 'http://fake');
		const json = (status: number, body: unknown) => {
			response.writeHead(status, { 'content-type': 'application/json' });
			response.end(JSON.stringify(body));
		};

		if (url.pathname === '/api/ready') {
			response.end(ready ? 'Ready' : 'Unloaded');
		} else if (url.pathname === '/api/currentsettings') {
			json(200, {
				current_engine_loaded: 'xtts',
				current_model_loaded: 'xtts - xttsv2_2.0.3',
				audio_format: 'wav',
				multivoice_capable: true,
				streaming_capable: true,
				temperature_capable: true,
				repetitionpenalty_capable: true,
				languages_capable: true,
				generationspeed_capable: true,
				pitch_capable: false
			});
		} else if (url.pathname === '/api/voices') {
			json(200, { status: 'success', voices });
		} else if (url.pathname === '/api/rvcvoices') {
			json(200, { status: 'success', rvcvoices: ['Disabled'] });
		} else if (url.pathname === '/api/stop-generation' && request.method === 'PUT') {
			state.stops++;
			json(200, { message: 'Cancelling current TTS generation' });
		} else if (url.pathname === '/api/tts-generate' && request.method === 'POST') {
			const form = new URLSearchParams(await readBody(request));
			state.lastForm = form;
			const text = form.get('text_input') ?? '';
			if (delay > 0) await new Promise((r) => setTimeout(r, delay));
			if (failing) {
				json(500, { status: 'generate-failure', error: 'TTS generation failed' });
				return;
			}
			state.generated.push(text);
			const name = `readhouse_${++counter}.wav`;
			files.set(name, silentWav(text, options.minSeconds, options.secondsPerChar));
			json(200, {
				status: 'generate-success',
				output_file_path: `/outputs/${name}`,
				output_file_url: `/audio/${name}`,
				output_cache_url: `/audiocache/${name}`
			});
		} else if (url.pathname.startsWith('/audio/')) {
			const file = files.get(decodeURIComponent(url.pathname.slice('/audio/'.length)));
			if (!file) {
				json(404, { detail: 'File not found' });
				return;
			}
			response.writeHead(200, { 'content-type': 'audio/wav', 'content-length': file.length });
			response.end(file);
		} else {
			json(404, { detail: 'Not Found' });
		}
	});

	await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;

	return {
		url: `http://127.0.0.1:${port}`,
		get generated() {
			return state.generated;
		},
		get lastForm() {
			return state.lastForm;
		},
		get stops() {
			return state.stops;
		},
		setDelay: (ms) => (delay = ms),
		setFailing: (value) => (failing = value),
		setReady: (value) => (ready = value),
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			})
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const port = Number(process.argv[2] ?? 7851);
	const fake = await startFakeAllTalk({
		port,
		delayMs: Number(process.env.FAKE_DELAY_MS ?? 300),
		minSeconds: Number(process.env.FAKE_MIN_SECONDS ?? 0),
		secondsPerChar: Number(process.env.FAKE_SECONDS_PER_CHAR ?? 0.01)
	});
	console.log(`Fake AllTalk listening on ${fake.url}`);
}
