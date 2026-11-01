import { describe, expect, it } from 'vitest';
import { collapseKeepingLines, normalizeText } from './normalize';
import { splitIntoSegments } from './segments';
import { isSceneBreak, textToBlocks } from './paragraphs';
import { cleanChapterTitle, splitChapters } from './chapters';
import { storyStart } from './front-matter';
import { extractAo3, looksLikeAo3 } from './ao3';

describe('normalizeText', () => {
	it('unifies line endings and removes invisible characters', () => {
		expect(normalizeText('a\r\nb\rc\u2028d')).toBe('a\nb\nc\nd');
		expect(normalizeText('soft\u00ADhy\u200Bphen\uFEFF')).toBe('softhyphen');
		expect(normalizeText('a\u00A0b\u3000c')).toBe('a b c');
		expect(normalizeText('bell\u0007 del\u007F')).toBe('bell del');
	});

	it('keeps tabs and newlines', () => {
		expect(normalizeText('\tindented\nline')).toBe('\tindented\nline');
	});

	it('collapses whitespace but keeps line breaks for verse', () => {
		expect(collapseKeepingLines('  roses  are\n\n  red  ')).toBe('roses are\nred');
	});
});

describe('splitIntoSegments', () => {
	it('returns short text whole and nothing for blank text', () => {
		expect(splitIntoSegments('Hello  there.', 100)).toEqual(['Hello there.']);
		expect(splitIntoSegments('   \n ', 100)).toEqual([]);
	});

	it('packs whole sentences up to the limit', () => {
		const text = 'One two three. Four five six. Seven eight nine.';
		const segments = splitIntoSegments(text, 30);
		expect(segments).toEqual(['One two three. Four five six.', 'Seven eight nine.']);
		for (const s of segments) expect(s.length).toBeLessThanOrEqual(30);
	});

	it('splits a very long sentence at clauses, then words, never exceeding the limit', () => {
		const long = Array.from({ length: 40 }, (_, i) => `clause number ${i}`).join(', ') + '.';
		const segments = splitIntoSegments(long, 60);
		expect(segments.length).toBeGreaterThan(1);
		for (const s of segments) expect(s.length).toBeLessThanOrEqual(60);
		expect(segments.join(' ')).toBe(long);
	});

	it('hard-cuts a single word longer than the limit', () => {
		const word = 'x'.repeat(130);
		const segments = splitIntoSegments(word, 50);
		expect(segments.map((s) => s.length)).toEqual([50, 50, 30]);
	});

	it('is deterministic', () => {
		const text = 'A sentence. '.repeat(200);
		expect(splitIntoSegments(text, 500)).toEqual(splitIntoSegments(text, 500));
	});

	it('rejects nonsense limits', () => {
		expect(() => splitIntoSegments('text', 5)).toThrow(RangeError);
		expect(() => splitIntoSegments('text', 100.5)).toThrow(RangeError);
	});
});

describe('textToBlocks', () => {
	it('joins hard-wrapped lines in blank-line separated text (Gutenberg style)', () => {
		const text = 'It was a dark\nand stormy night.\n\nThe rain fell\nin torrents.';
		expect(textToBlocks(text)).toEqual([
			{ type: 'text', text: 'It was a dark and stormy night.' },
			{ type: 'text', text: 'The rain fell in torrents.' }
		]);
	});

	it('splits on indentation when there are no blank lines', () => {
		const text = '  First paragraph\nstill first.\n  Second paragraph.\n  Third.';
		expect(textToBlocks(text).map((b) => b.type === 'text' && b.text)).toEqual([
			'First paragraph still first.',
			'Second paragraph.',
			'Third.'
		]);
	});

	it('treats each line as a paragraph in single-newline text', () => {
		expect(textToBlocks('One.\nTwo.\nThree.')).toHaveLength(3);
	});

	it('keeps scene breaks between paragraphs but never at the edges or doubled', () => {
		const text = '***\n\nBefore.\n\n* * *\n\n---\n\nAfter.\n\n~~~';
		expect(textToBlocks(text)).toEqual([
			{ type: 'text', text: 'Before.' },
			{ type: 'break' },
			{ type: 'text', text: 'After.' }
		]);
	});

	it('splits a wall of text into readable pieces', () => {
		const wall = 'This is a sentence that goes on. '.repeat(200);
		const blocks = textToBlocks(wall);
		expect(blocks.length).toBeGreaterThan(3);
		for (const b of blocks) if (b.type === 'text') expect(b.text.length).toBeLessThanOrEqual(1500);
	});

	it('recognizes scene break lines', () => {
		for (const line of [
			'***',
			'* * *',
			'---',
			'~ ~ ~',
			'\u2042',
			'#',
			'###',
			'\u2022\u2022\u2022'
		]) {
			expect(isSceneBreak(line), line).toBe(line !== '#');
		}
		expect(isSceneBreak('Hello')).toBe(false);
		expect(isSceneBreak('ooo')).toBe(false);
	});

	it('returns nothing for empty input', () => {
		expect(textToBlocks('')).toEqual([]);
		expect(textToBlocks('\n\n  \n')).toEqual([]);
	});
});

describe('splitChapters', () => {
	it('splits on chapter headings and keeps opening text', () => {
		const text = [
			'A dedication.',
			'',
			'Chapter 1: The Start',
			'',
			'Once upon a time.',
			'',
			'CHAPTER TWO',
			'',
			'The middle.',
			'',
			'Epilogue',
			'',
			'The end.'
		].join('\n');
		const chapters = splitChapters(text, 'Book');
		expect(chapters.map((c) => c.title)).toEqual([
			'Opening',
			'Chapter 1: The Start',
			'CHAPTER TWO',
			'Epilogue'
		]);
		expect(chapters[1].blocks).toEqual([{ type: 'text', text: 'Once upon a time.' }]);
	});

	it('falls back to one chapter without headings', () => {
		const chapters = splitChapters('Just some text.\n\nMore text.', 'My Story');
		expect(chapters).toHaveLength(1);
		expect(chapters[0].title).toBe('My Story');
	});

	it('only trusts bare roman numerals when there are several', () => {
		const one = splitChapters('Intro.\n\nI\n\nText here.\n\nMore.', 'T');
		expect(one).toHaveLength(1);
		const many = splitChapters('I\n\nOne.\n\nII\n\nTwo.\n\nIII\n\nThree.', 'T');
		expect(many.map((c) => c.title)).toEqual(['I', 'II', 'III']);
	});

	it('ignores a table of contents', () => {
		const text = [
			'Contents',
			'',
			'Chapter 1',
			'',
			'Chapter 2',
			'',
			'Chapter 1',
			'',
			'First.',
			'',
			'Chapter 2',
			'',
			'Second.'
		].join('\n');
		const chapters = splitChapters(text, 'T');
		expect(chapters.map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2']);
		expect(chapters[0].blocks).toEqual([{ type: 'text', text: 'First.' }]);
	});

	it('ignores a table of contents written as a list without blank lines', () => {
		const text = [
			'Contents',
			'',
			' CHAPTER I.     Down the Rabbit-Hole',
			' CHAPTER II.    The Pool of Tears',
			' CHAPTER III.   A Caucus-Race',
			'',
			'CHAPTER I.',
			'Down the Rabbit-Hole',
			'',
			'Alice was beginning to get very tired.',
			'',
			'CHAPTER II.',
			'The Pool of Tears',
			'',
			'Curiouser and curiouser!'
		].join('\n');
		const chapters = splitChapters(text, 'T');
		expect(chapters.map((c) => c.title)).toEqual([
			'CHAPTER I. Down the Rabbit-Hole',
			'CHAPTER II. The Pool of Tears'
		]);
		expect(chapters[0].blocks).toEqual([
			{ type: 'text', text: 'Alice was beginning to get very tired.' }
		]);
	});

	it('accepts title-case subtitles that end in a question or exclamation mark', () => {
		const text =
			'CHAPTER XI.\nWho Stole the Tarts?\n\nText.\n\nCHAPTER XII.\nRun away now!\n\nMore.';
		expect(splitChapters(text, 'T').map((c) => c.title)).toEqual([
			'CHAPTER XI. Who Stole the Tarts?',
			'CHAPTER XII.'
		]);
	});

	it('does not take the first sentence of a chapter as its subtitle', () => {
		const text = 'Chapter 1\n\nShe ran.\n\nMore.\n\nChapter 2\n\nEnd.';
		expect(splitChapters(text, 'T').map((c) => c.title)).toEqual(['Chapter 1', 'Chapter 2']);
	});

	it('does not mistake prose starting with "Part" for a heading', () => {
		const text =
			'Intro.\n\nPart of me wanted to leave, but I stayed for a very long time indeed.\n\nEnd.';
		expect(splitChapters(text, 'T')).toHaveLength(1);
	});

	it('knows the staves of A Christmas Carol, after its contents list', () => {
		const staves = ['I', 'II', 'III', 'IV', 'V'];
		const text = [
			staves.map((n) => `Stave ${n.padStart(3)}: Spirit`).join('\n'),
			...staves.map((n) => `STAVE ${n}:  SPIRIT\n\nScrooge awoke.`)
		].join('\n\n\n');
		expect(splitChapters(text, 'T').map((c) => c.title)).toEqual(
			staves.map((n) => `STAVE ${n}: SPIRIT`)
		);
	});
});

describe('cleanChapterTitle', () => {
	it('drops an illustration caption before the chapter label', () => {
		expect(cleanChapterTitle('He rode a black horse. CHAPTER III.')).toBe('CHAPTER III.');
		expect(cleanChapterTitle('  Chapter   2:  Rain ')).toBe('Chapter 2: Rain');
		expect(cleanChapterTitle('The Part of the Story')).toBe('The Part of the Story');
	});
});

describe('AO3 paste extraction', () => {
	const page = [
		'Main Content',
		'Archive of Our Own beta',
		'Hi, reader!',
		'Work Header',
		'Rating:',
		'Teen And Up Audiences',
		'Additional Tags:',
		'Fluff',
		'Stats:',
		'Published:',
		'2026-01-01',
		'My Great Work',
		'Chapter 3: Rain',
		'Summary:',
		'They get caught in the rain.',
		'Notes:',
		'Thanks for reading!',
		'Chapter Text',
		'The rain started at noon.',
		'',
		'Nobody had an umbrella.',
		'Actions',
		'Kudos',
		'Footer'
	].join('\n');

	it('detects AO3 pages', () => {
		expect(looksLikeAo3(page)).toBe(true);
		expect(looksLikeAo3('Just a story about the Archive of Our Own.')).toBe(false);
	});

	it('keeps title, summary, notes and story; drops page chrome', () => {
		const result = extractAo3(page);
		expect(result?.title).toBe('Chapter 3: Rain');
		expect(result?.text).toContain('They get caught in the rain.');
		expect(result?.text).toContain('Nobody had an umbrella.');
		expect(result?.text).not.toContain('Rating:');
		expect(result?.text).not.toContain('Footer');
		expect(result?.text).not.toContain('Actions');
	});

	it('returns null for text that is not from AO3', () => {
		expect(extractAo3('Chapter Text\nHello')).toBeNull();
	});
});

describe('storyStart', () => {
	const chapter = (title: string, text = 'Text.') => ({
		title,
		blocks: [{ type: 'text' as const, text }]
	});

	it('skips praise, copyright, contents and "also by" pages', () => {
		const chapters = [
			'Praise for The Dune Chronicles',
			'Other Books by Frank Herbert',
			'Copyright',
			'Dedication',
			'Contents',
			'Book One: Dune'
		].map((t) => chapter(t));
		expect(storyStart(chapters)).toBe(5);
	});

	it('keeps prologues, epigraphs and prefaces that are part of the book', () => {
		expect(storyStart([chapter('Prologue'), chapter('Chapter 1')])).toBe(0);
		expect(storyStart([chapter('Epigraph'), chapter('Chapter 1')])).toBe(0);
		expect(storyStart([chapter('Preface'), chapter('Stave I')])).toBe(0);
	});

	it('skips AO3\u2019s preface page by its wording', () => {
		const preface = chapter('Preface', 'Posted originally on the Archive of Our Own at http://x.');
		expect(storyStart([preface, chapter('Chapter 1')])).toBe(1);
	});

	it('never goes past the last chapter', () => {
		expect(storyStart([chapter('Copyright')])).toBe(0);
		expect(storyStart([])).toBe(0);
	});
});
