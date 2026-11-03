import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeAllTalk, type FakeAllTalk } from '../../../tests/fake-alltalk.js';
import type { ParsedBook } from '#lib/book.js';
import { DEFAULT_VOICE_SETTINGS } from '#lib/settings.js';
import { createServices, type Services } from './app.js';
import { AllTalk } from './alltalk.js';
import { SpeechCancelled } from './speech.js';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { Database, MIGRATIONS } from './db.js';
import { Library } from './library.js';

const hasFfmpeg = (() => {
	try {
		execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
})();

let fake: FakeAllTalk;
let dir: string;
let services: Services;

beforeAll(async () => {
	fake = await startFakeAllTalk();
});
afterAll(() => fake.close());

function make(overrides: { audioCacheMaxBytes?: number; audioFormat?: 'auto' | 'original' } = {}) {
	dir = mkdtempSync(join(tmpdir(), 'readhouse-test-'));
	services = createServices({
		dataDir: dir,
		alltalkUrl: fake.url,
		uploadMaxBytes: 1024 * 1024,
		audioCacheMaxBytes: overrides.audioCacheMaxBytes ?? 64 * 1024 * 1024,
		audioFormat: overrides.audioFormat ?? 'original',
		passcode: undefined
	});
}

beforeEach(() => {
	fake.setDelay(0);
	fake.setFailing(false);
	make();
});
afterEach(() => {
	services.db.close();
	rmSync(dir, { recursive: true, force: true });
});

const book: ParsedBook = {
	title: 'Test',
	author: 'Author',
	language: 'en',
	source: 'txt',
	startChapter: 0,
	chapters: [
		{ title: 'One', blocks: [{ type: 'text', text: 'Hello.' }, { type: 'break' }] },
		{ title: 'Two', blocks: [{ type: 'text', text: 'World.' }] }
	],
	cover: { bytes: new Uint8Array([1, 2, 3]), mime: 'image/png' }
};

describe('Library', () => {
	it('stores and reads back a book with chapters, cover and word counts', () => {
		const id = services.library.add(book);
		const detail = services.library.get(id);
		expect(detail).toMatchObject({
			title: 'Test',
			chapterCount: 2,
			wordCount: 2,
			hasCover: true,
			progress: null
		});
		expect(detail?.chapters).toEqual([
			{ title: 'One', wordCount: 1 },
			{ title: 'Two', wordCount: 1 }
		]);
		expect(services.library.chapter(id, 0, 125)?.blocks).toEqual(book.chapters[0].blocks);
		expect(services.library.chapter(id, 2, 125)).toBeNull();
		expect(services.library.cover(id)?.mime).toBe('image/png');
	});

	it('lists books most recently opened first', () => {
		const a = services.library.add({ ...book, title: 'A' });
		const b = services.library.add({ ...book, title: 'B' });
		services.library.markOpened(a);
		expect(services.library.list().map((x) => x.id)).toEqual([a, b]);
	});

	it('saves progress only for positions inside the book', () => {
		const id = services.library.add(book);
		expect(services.library.saveProgress(id, 1, 0)).toBe('saved');
		expect(services.library.saveProgress(id, 1, 1)).toBe('out-of-range');
		expect(services.library.saveProgress(id, 5, 0)).toBe('out-of-range');
		expect(services.library.saveProgress('nope', 0, 0)).toBe('no-book');
		expect(services.library.get(id)?.progress).toMatchObject({ chapter: 1, block: 0 });
	});

	it('deletes a book with its chapters, cover and progress', () => {
		const id = services.library.add(book);
		services.library.saveProgress(id, 0, 0);
		expect(services.library.remove(id)).toBe(true);
		expect(services.library.get(id)).toBeNull();
		const orphans = services.db
			.statement(
				`SELECT (SELECT count(*) FROM chapters) + (SELECT count(*) FROM covers) + (SELECT count(*) FROM progress) AS n`
			)
			.get() as { n: number };
		expect(orphans.n).toBe(0);
		expect(services.library.remove(id)).toBe(false);
	});

	it('finds the places where words appear, in reading order, whatever the case or accents', () => {
		const id = services.library.add({
			...book,
			chapters: [
				{ title: 'One', blocks: [{ type: 'heading', text: 'At Netherfield' }, { type: 'break' }] },
				{
					title: 'Two',
					blocks: [
						{ type: 'text', text: 'Nobody here.' },
						{ type: 'text', text: 'A note came from NETHERFIELD; the servant waited.' },
						{ type: 'text', text: 'The caf\u00e9 was closed. Netherfield again.' }
					]
				}
			]
		});
		const other = services.library.add(book);
		const results = services.library.search(id, 'netherf', 50);
		expect(results).toMatchObject({ total: 3, chapters: 2 });
		expect(results?.hits.map((hit) => [hit.chapter, hit.block])).toEqual([
			[0, 0],
			[1, 1],
			[1, 2]
		]);
		expect(results?.hits[1].parts).toEqual([
			{ text: 'A note came from ', match: false },
			{ text: 'NETHERFIELD', match: true },
			{ text: '; the servant waited.', match: false }
		]);
		expect(services.library.search(id, 'Cafe', 50)?.total).toBe(1);
		expect(services.library.search(id, 'servant waited', 50)?.total).toBe(1);
		expect(services.library.search(id, 'waited servant', 50)?.total).toBe(0);
		expect(services.library.search(id, 'netherfield', 1)).toMatchObject({ total: 3 });
		expect(services.library.search(id, 'netherfield', 1)?.hits).toHaveLength(1);
		expect(services.library.search(other, 'netherfield', 50)?.total).toBe(0);
		expect(services.library.search(id, '" OR *', 50)).toEqual({ hits: [], total: 0, chapters: 0 });
		expect(services.library.search('nope', 'netherfield', 50)).toBeNull();
	});

	it('forgets a book\u2019s text for search when the book is removed', () => {
		const id = services.library.add(book);
		services.library.remove(id);
		const left = services.db.statement(`SELECT count(*) AS n FROM block_search`).get() as {
			n: number;
		};
		expect(left.n).toBe(0);
	});

	it('makes books imported before search findable', () => {
		const path = join(dir, 'old.db');
		const old = new DatabaseSync(path);
		for (const sql of MIGRATIONS.slice(0, 3)) old.exec(sql);
		old.exec(`PRAGMA user_version = 3`);
		old.exec(
			`INSERT INTO books (id, title, source, chapter_count, word_count, created_at)
			 VALUES ('b', 'Old', 'txt', 1, 3, 0)`
		);
		old
			.prepare(
				`INSERT INTO chapters (book_id, position, title, blocks, block_count, word_count)
				 VALUES ('b', 0, 'One', ?, 3, 3)`
			)
			.run(
				JSON.stringify([
					{ type: 'heading', text: 'Opening' },
					{ type: 'break' },
					{ type: 'text', text: 'An old book.' }
				])
			);
		old.close();
		const db = new Database(path);
		const library = new Library(db);
		expect(library.search('b', 'old book', 50)?.hits).toEqual([
			{
				chapter: 0,
				block: 2,
				parts: [
					{ text: 'An ', match: false },
					{ text: 'old book', match: true },
					{ text: '.', match: false }
				]
			}
		]);
		db.close();
	});

	it('rolls back a failed import completely', () => {
		expect(() =>
			services.library.add({ ...book, chapters: [{ title: 'Empty', blocks: [] }] })
		).toThrow();
		expect(services.library.list()).toEqual([]);
	});
});

describe('Settings', () => {
	it('returns defaults, saves, and ignores invalid stored fields', () => {
		expect(services.settings.voice()).toEqual(DEFAULT_VOICE_SETTINGS);
		services.settings.saveVoice({ ...DEFAULT_VOICE_SETTINGS, voice: 'male_01.wav' });
		expect(services.settings.voice().voice).toBe('male_01.wav');
		services.db
			.statement(`UPDATE settings SET data = ? WHERE id = 1`)
			.run(JSON.stringify({ voice: 'ok.wav', temperature: 99, language: 'xx' }));
		expect(services.settings.voice()).toEqual({ ...DEFAULT_VOICE_SETTINGS, voice: 'ok.wav' });
	});

	it('keeps the narrator off while it is set aside, whatever was stored', () => {
		services.settings.saveVoice({ ...DEFAULT_VOICE_SETTINGS, narratorEnabled: true });
		expect(services.settings.voice().narratorEnabled).toBe(false);
		services.db
			.statement(`UPDATE settings SET data = ? WHERE id = 1`)
			.run(JSON.stringify({ ...DEFAULT_VOICE_SETTINGS, narratorEnabled: true }));
		expect(services.settings.voice().narratorEnabled).toBe(false);
	});
});

describe('AllTalk client', () => {
	it('reads status, engine and voices', async () => {
		expect(await services.alltalk.ready()).toBe(true);
		expect(await services.alltalk.voices()).toContain('female_01.wav');
		const engine = await services.alltalk.engine();
		expect(engine.model).toBe('xtts - xttsv2_2.0.3');
		expect(engine.capabilities.streaming).toBe(true);
	});

	it('sends voice settings as AllTalk form fields', async () => {
		await services.alltalk.generate('Hi.', {
			...DEFAULT_VOICE_SETTINGS,
			voice: 'male_01.wav',
			narratorEnabled: true,
			narratorVoice: 'narrator.wav',
			temperature: 0.7
		});
		const form = fake.lastForm!;
		expect(form.get('character_voice_gen')).toBe('male_01.wav');
		expect(form.get('narrator_enabled')).toBe('true');
		expect(form.get('narrator_voice_gen')).toBe('narrator.wav');
		expect(form.get('text_not_inside')).toBe('narrator');
		expect(form.get('temperature')).toBe('0.7');
		expect(form.has('repetition_penalty')).toBe(false);
		expect(form.get('autoplay')).toBe('false');
	});

	it('sends narrator RVC, silent unquoted text and pitch', async () => {
		await services.alltalk.generate('Hi.', {
			...DEFAULT_VOICE_SETTINGS,
			narratorEnabled: true,
			unquotedIs: 'silent',
			rvcNarratorVoice: 'voices\\narrator.pth',
			rvcNarratorPitch: -3,
			pitch: 2
		});
		const form = fake.lastForm!;
		expect(form.get('text_not_inside')).toBe('silent');
		expect(form.get('rvcnarrator_voice_gen')).toBe('voices\\narrator.pth');
		expect(form.get('rvcnarrator_pitch')).toBe('-3');
		expect(form.get('pitch')).toBe('2');
		// Without the narrator, its RVC isn't sent, and pitch 0 leaves the engine's own.
		await services.alltalk.generate('Hi.', DEFAULT_VOICE_SETTINGS);
		expect(fake.lastForm!.has('rvcnarrator_voice_gen')).toBe(false);
		expect(fake.lastForm!.has('pitch')).toBe(false);
	});

	it('switches models, low VRAM and DeepSpeed', async () => {
		const engine = await services.alltalk.engine();
		expect(engine.models).toEqual(['xtts - xttsv2_2.0.3', 'apitts - xttsv2_2.0.3']);
		await services.alltalk.loadModel('apitts - xttsv2_2.0.3');
		expect((await services.alltalk.engine()).model).toBe('apitts - xttsv2_2.0.3');
		// AllTalk answers 200 for a model it doesn't have; the client still reports a refusal.
		await expect(services.alltalk.loadModel('nope')).rejects.toMatchObject({ kind: 'rejected' });
		await services.alltalk.loadModel('xtts - xttsv2_2.0.3');

		await services.alltalk.setLowVram(true);
		expect((await services.alltalk.engine()).lowVram.enabled).toBe(true);
		await services.alltalk.setLowVram(false);
		await services.alltalk.setDeepSpeed(true);
		expect((await services.alltalk.engine()).deepSpeed.enabled).toBe(true);
		await services.alltalk.setDeepSpeed(false);
	});

	it('recovers when low VRAM mode unloads the model on a machine without CUDA', async () => {
		const cpu = await startFakeAllTalk({ cuda: false });
		try {
			const alltalk = new AllTalk(cpu.url);
			await alltalk.setLowVram(true);
			// AllTalk said success, but the mode is off and the model is gone.
			expect((await alltalk.engine()).lowVram.enabled).toBe(false);
			await expect(alltalk.generate('Hi.', DEFAULT_VOICE_SETTINGS)).rejects.toThrow();
			await alltalk.loadModel('xtts - xttsv2_2.0.3');
			expect(await alltalk.generate('Hi.', DEFAULT_VOICE_SETTINGS)).toMatch(/\.wav$/);
		} finally {
			await cpu.close();
		}
	});

	it('reports an unreachable server clearly', async () => {
		const offline = new AllTalk('http://127.0.0.1:9');
		await expect(offline.ready()).rejects.toMatchObject({ kind: 'unreachable' });
	});

	it('never follows a URL from a response to another host', async () => {
		let requested = '';
		const spy = new AllTalk('http://alltalk.local', async (input) => {
			requested = String(input);
			return Response.json({
				status: 'generate-success',
				output_file_url: 'http://evil.example/audio/x.wav'
			});
		});
		const file = await spy.generate('x', DEFAULT_VOICE_SETTINGS);
		expect(file).toBe('x.wav');
		await spy.audio(file).catch(() => undefined);
		expect(new URL(requested).host).toBe('alltalk.local');
		await expect(spy.audio('../../etc/passwd')).rejects.toThrow();
	});
});

describe('Speech', () => {
	it('generates once, then serves from the cache', async () => {
		const before = fake.generated.length;
		const a = await services.speech.speak('Cached text.', DEFAULT_VOICE_SETTINGS, 'now');
		const b = await services.speech.speak('Cached text.', DEFAULT_VOICE_SETTINGS, 'now');
		expect(a).toBe(b);
		expect(fake.generated.length - before).toBe(1);
		const audio = services.speech.cached(a)!;
		const bytes = await readFile(audio.path);
		expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
		expect(audio.mime).toBe('audio/wav');
	});

	it('keeps cache keys of settings that predate pitch and narrator RVC', async () => {
		const key = (settings: typeof DEFAULT_VOICE_SETTINGS) => services.speech.key('Same.', settings);
		const base = await key(DEFAULT_VOICE_SETTINGS);
		// Narrator RVC with the narrator off changes nothing that is heard.
		expect(await key({ ...DEFAULT_VOICE_SETTINGS, rvcNarratorVoice: 'n.pth' })).toBe(base);
		expect(await key({ ...DEFAULT_VOICE_SETTINGS, pitch: 3 })).not.toBe(base);
		const narrator = { ...DEFAULT_VOICE_SETTINGS, narratorEnabled: true };
		expect(await key({ ...narrator, rvcNarratorVoice: 'n.pth' })).not.toBe(await key(narrator));
	});

	it('keys the cache by voice settings', async () => {
		const a = await services.speech.speak('Same.', DEFAULT_VOICE_SETTINGS, 'now');
		const b = await services.speech.speak(
			'Same.',
			{ ...DEFAULT_VOICE_SETTINGS, voice: 'male_01.wav' },
			'now'
		);
		expect(a).not.toBe(b);
	});

	it('shares one generation between identical concurrent requests', async () => {
		fake.setDelay(50);
		const before = fake.generated.length;
		const results = await Promise.all(
			[1, 2, 3].map(() => services.speech.speak('Concurrent.', DEFAULT_VOICE_SETTINGS, 'soon'))
		);
		expect(new Set(results).size).toBe(1);
		expect(fake.generated.length - before).toBe(1);
	});

	it('puts "now" ahead of queued prefetches', async () => {
		fake.setDelay(30);
		const start = fake.generated.length;
		const soon = ['S1', 'S2', 'S3'].map((t) =>
			services.speech.speak(t, DEFAULT_VOICE_SETTINGS, 'soon')
		);
		await new Promise((r) => setTimeout(r, 5));
		const now = services.speech.speak('NOW', DEFAULT_VOICE_SETTINGS, 'now');
		await Promise.all([...soon, now]);
		const order = fake.generated.slice(start);
		expect(order[0]).toBe('S1');
		expect(order[1]).toBe('NOW');
	});

	it('drops an abandoned prefetch before it reaches AllTalk', async () => {
		fake.setDelay(40);
		const start = fake.generated.length;
		const first = services.speech.speak('Busy.', DEFAULT_VOICE_SETTINGS, 'now');
		const controller = new AbortController();
		const dropped = services.speech.speak(
			'Never needed.',
			DEFAULT_VOICE_SETTINGS,
			'soon',
			controller.signal
		);
		controller.abort();
		await expect(dropped).rejects.toBeInstanceOf(SpeechCancelled);
		await first;
		await new Promise((r) => setTimeout(r, 60));
		expect(fake.generated.slice(start)).toEqual(['Busy.']);
	});

	it('reports AllTalk failures to every waiting caller and recovers', async () => {
		fake.setFailing(true);
		await expect(
			services.speech.speak('Fails.', DEFAULT_VOICE_SETTINGS, 'now')
		).rejects.toMatchObject({ kind: 'rejected' });
		fake.setFailing(false);
		await expect(services.speech.speak('Fails.', DEFAULT_VOICE_SETTINGS, 'now')).resolves.toMatch(
			/^[0-9a-f]{64}$/
		);
	});

	it('evicts the least recently played audio when over budget', async () => {
		services.db.close();
		rmSync(dir, { recursive: true, force: true });
		make({ audioCacheMaxBytes: 12_000 });
		const first = await services.speech.speak('a'.repeat(1000), DEFAULT_VOICE_SETTINGS, 'now');
		const second = await services.speech.speak('b'.repeat(1000), DEFAULT_VOICE_SETTINGS, 'now');
		expect(services.speech.cached(first)).toBeNull();
		expect(services.speech.cached(second)).not.toBeNull();
		expect(readdirSync(join(dir, 'audio'))).toEqual([second]);
	});

	it.runIf(hasFfmpeg)('compresses audio to AAC when ffmpeg is available', async () => {
		services.db.close();
		rmSync(dir, { recursive: true, force: true });
		make({ audioFormat: 'auto' });
		const hash = await services.speech.speak(
			'Compressed. '.repeat(20),
			DEFAULT_VOICE_SETTINGS,
			'now'
		);
		const audio = services.speech.cached(hash)!;
		expect(audio.mime).toBe('audio/mp4');
		const bytes = await readFile(audio.path);
		expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
		expect(readdirSync(join(dir, 'audio'))).toEqual([hash]);
	});

	it('regenerates when a cached file has gone missing', async () => {
		const hash = await services.speech.speak('Vanishing.', DEFAULT_VOICE_SETTINGS, 'now');
		rmSync(join(dir, 'audio', hash));
		const before = fake.generated.length;
		expect(await services.speech.speak('Vanishing.', DEFAULT_VOICE_SETTINGS, 'now')).toBe(hash);
		expect(fake.generated.length - before).toBe(1);
	});
});

describe('Preparing a whole book', () => {
	const prose: ParsedBook = {
		title: 'Whole',
		author: null,
		language: 'en',
		source: 'txt',
		startChapter: 0,
		cover: null,
		chapters: [
			{ title: 'One', blocks: [{ type: 'text', text: 'The first chapter has one passage.' }] },
			{
				title: 'Two',
				blocks: [
					{
						type: 'text',
						text: 'The second chapter is longer. ' + 'It goes on a while. '.repeat(12)
					}
				]
			}
		]
	};

	it('generates and pins every passage, then reads with its snapshot after settings change', async () => {
		const id = services.library.add(prose);
		const engine = await services.alltalk.engine();
		services.preparer.start(id, DEFAULT_VOICE_SETTINGS, engine);
		await services.preparer.idle();
		const status = services.preparer.status(id)!;
		expect(status).toMatchObject({ state: 'ready', model: 'xtts - xttsv2_2.0.3' });
		expect(status.done).toBe(status.total);
		expect(status.total).toBeGreaterThan(2);
		const pins = services.db
			.statement(`SELECT count(*) AS n FROM pinned_audio WHERE book_id = ?`)
			.get(id) as { n: number };
		expect(pins.n).toBe(status.total);

		// The library's voice changes; the book keeps the voice it was prepared with.
		services.settings.saveVoice({ ...DEFAULT_VOICE_SETTINGS, voice: 'male_01.wav' });
		expect(services.preparer.voice(id)!.settings.voice).toBe('');
	});

	it('plays a prepared book with AllTalk switched off', async () => {
		const own = await startFakeAllTalk();
		const ownDir = mkdtempSync(join(tmpdir(), 'readhouse-prep-'));
		const local = createServices({
			dataDir: ownDir,
			alltalkUrl: own.url,
			uploadMaxBytes: 1024 * 1024,
			audioCacheMaxBytes: 64 * 1024 * 1024,
			audioFormat: 'original',
			passcode: undefined
		});
		try {
			const id = local.library.add(prose);
			local.preparer.start(id, DEFAULT_VOICE_SETTINGS, await local.alltalk.engine());
			await local.preparer.idle();
			await own.close();
			const voice = local.preparer.voice(id)!;
			const chapter = local.library.chapter(id, 1, voice.settings.passageChars)!;
			const { passageText } = await import('#lib/text/passages.js');
			const text = passageText(chapter.blocks, chapter.passages[0]);
			// No AllTalk at all: the snapshot names the model, the audio is already there.
			const hash = await local.speech.speak(text, voice.settings, 'now', undefined, voice.snapshot);
			expect(local.speech.cached(hash)).not.toBeNull();
		} finally {
			local.db.close();
			rmSync(ownDir, { recursive: true, force: true });
		}
	});

	it('pauses with a reason when AllTalk switches to another model', async () => {
		// Slow enough that the switch lands while the book is still being prepared.
		fake.setDelay(150);
		const id = services.library.add(prose);
		services.preparer.start(id, DEFAULT_VOICE_SETTINGS, await services.alltalk.engine());
		await services.alltalk.loadModel('apitts - xttsv2_2.0.3');
		try {
			await services.preparer.idle();
			const status = services.preparer.status(id)!;
			expect(status.state).toBe('paused');
			expect(status.message).toContain('apitts - xttsv2_2.0.3');
			// Switched back, it continues with its own settings and finishes.
			await services.alltalk.loadModel('xtts - xttsv2_2.0.3');
			services.preparer.continue(id);
			await services.preparer.idle();
			expect(services.preparer.status(id)!.state).toBe('ready');
		} finally {
			await services.alltalk.loadModel('xtts - xttsv2_2.0.3');
		}
	});

	it('keeps pinned audio when the cache is over budget, and forgets on request', async () => {
		make({ audioCacheMaxBytes: 1 });
		const id = services.library.add(prose);
		services.preparer.start(id, DEFAULT_VOICE_SETTINGS, await services.alltalk.engine());
		await services.preparer.idle();
		const total = services.preparer.status(id)!.total;
		// Unpinned audio over a one-byte budget is evicted; the book's isn't.
		await services.speech.speak('Something else entirely.', DEFAULT_VOICE_SETTINGS, 'now');
		const kept = services.db
			.statement(
				`SELECT count(*) AS n FROM audio WHERE hash IN (SELECT hash FROM pinned_audio WHERE book_id = ?)`
			)
			.get(id) as { n: number };
		expect(kept.n).toBe(total);
		services.preparer.forget(id);
		expect(services.preparer.status(id)).toBeNull();
	});

	it('prepares behind prefetching ("later" after "soon")', async () => {
		fake.setDelay(30);
		const start = fake.generated.length;
		const later = ['L1', 'L2'].map((t) =>
			services.speech.speak(t, DEFAULT_VOICE_SETTINGS, 'later')
		);
		await new Promise((r) => setTimeout(r, 5));
		const soon = services.speech.speak('SOON', DEFAULT_VOICE_SETTINGS, 'soon');
		await Promise.all([...later, soon]);
		expect(fake.generated.slice(start)).toEqual(['L1', 'SOON', 'L2']);
	});
});
