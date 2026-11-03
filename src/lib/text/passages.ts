/**
 * Passages: the pieces of a chapter read aloud one at a time, built by size rather than by the
 * book's paragraphs. Sentences are packed up to `maxChars` characters across paragraphs, so a
 * run of short dialogue lines becomes one request and a wall of text becomes several. A
 * paragraph's end is preferred as a break once a passage is half full; headings, scene breaks
 * and the chapter's end always break.
 *
 * Pure and deterministic. The server builds a chapter's passages and sends them with the
 * chapter, so the reader never has to agree with the server's sentence splitting.
 */

import type { Block } from '#lib/book.js';
import { collapseWhitespace } from './normalize';

/** A stretch of one block's text: offsets into `block.text`, end exclusive. */
export interface PassagePiece {
	block: number;
	start: number;
	end: number;
}

export interface Passage {
	pieces: PassagePiece[];
}

export const PASSAGE_MIN_CHARS = 60;
export const PASSAGE_MAX_CHARS = 1000;
/** About seven seconds of speech. */
export const DEFAULT_PASSAGE_CHARS = 125;
/** Measured with XTTS: 120 characters made 6.7 s of speech. A rough guide for the UI only. */
const CHARS_PER_SECOND = 18;

/** Roughly how long a passage of `chars` characters takes to say, in whole seconds. */
export const speechSeconds = (chars: number): number =>
	Math.max(1, Math.round(chars / CHARS_PER_SECOND));

interface Unit extends PassagePiece {
	length: number;
	/** The last unit of a paragraph: a good place to end a passage. */
	paragraphEnd: boolean;
	/** A heading stands alone. */
	alone: boolean;
}

const segmenters = new Map<string, Intl.Segmenter>();

function sentences(locale: string): Intl.Segmenter {
	let segmenter = segmenters.get(locale);
	if (!segmenter) {
		segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
		segmenters.set(locale, segmenter);
	}
	return segmenter;
}

const spoken = (text: string, start: number, end: number) =>
	collapseWhitespace(text.slice(start, end)).length;

/** The range without its leading and trailing whitespace, or null when nothing is left. */
function trim(text: string, start: number, end: number): [number, number] | null {
	while (start < end && /\s/.test(text[start])) start++;
	while (end > start && /\s/.test(text[end - 1])) end--;
	return start < end ? [start, end] : null;
}

/** Cuts a range after each match of `boundary`, keeping the pieces' offsets. */
function cut(text: string, start: number, end: number, boundary: RegExp): [number, number][] {
	const ranges: [number, number][] = [];
	let from = start;
	const pattern = new RegExp(boundary.source, 'g');
	pattern.lastIndex = start;
	for (let match = pattern.exec(text); match && match.index < end; match = pattern.exec(text)) {
		const at = match.index + match[0].length;
		if (at >= end) break;
		const piece = trim(text, from, at);
		if (piece) ranges.push(piece);
		from = at;
	}
	const last = trim(text, from, end);
	if (last) ranges.push(last);
	return ranges;
}

/** Joins neighbouring ranges while they fit in `max`. */
function packRanges(text: string, ranges: [number, number][], max: number): [number, number][] {
	const packed: [number, number][] = [];
	for (const range of ranges) {
		const last = packed.at(-1);
		if (last && spoken(text, last[0], range[1]) <= max) last[1] = range[1];
		else packed.push([...range]);
	}
	return packed;
}

/** A sentence longer than `max`: cut at clause punctuation, then at spaces, then anywhere. */
function splitLong(text: string, start: number, end: number, max: number): [number, number][] {
	const pieces = cut(text, start, end, /[,;:\u2013\u2014]\s+/).flatMap(([s, e]) => {
		if (spoken(text, s, e) <= max) return [[s, e] as [number, number]];
		return cut(text, s, e, /\s+/).flatMap(([ws, we]) => {
			const parts: [number, number][] = [];
			for (let i = ws; i < we; i += max) parts.push([i, Math.min(we, i + max)]);
			return parts;
		});
	});
	return packRanges(text, pieces, max);
}

function units(blocks: readonly Block[], max: number, locale: string): (Unit | 'break')[] {
	const out: (Unit | 'break')[] = [];
	blocks.forEach((block, index) => {
		if (block.type === 'break') {
			out.push('break');
			return;
		}
		const ranges: [number, number][] = [];
		for (const { segment, index: at } of sentences(locale).segment(block.text)) {
			const range = trim(block.text, at, at + segment.length);
			if (!range) continue;
			if (spoken(block.text, ...range) <= max) ranges.push(range);
			else ranges.push(...splitLong(block.text, range[0], range[1], max));
		}
		ranges.forEach(([start, end], i) => {
			out.push({
				block: index,
				start,
				end,
				length: spoken(block.text, start, end),
				paragraphEnd: i === ranges.length - 1,
				alone: block.type === 'heading'
			});
		});
	});
	return out;
}

export function buildPassages(
	blocks: readonly Block[],
	maxChars: number = DEFAULT_PASSAGE_CHARS,
	locale = 'en'
): Passage[] {
	if (!Number.isInteger(maxChars) || maxChars < PASSAGE_MIN_CHARS) {
		throw new RangeError(`maxChars must be an integer of at least ${PASSAGE_MIN_CHARS}`);
	}
	const passages: Passage[] = [];
	let pieces: PassagePiece[] = [];
	let length = 0;
	let alone = false;
	const flush = () => {
		if (pieces.length) passages.push({ pieces });
		pieces = [];
		length = 0;
		alone = false;
	};

	for (const unit of units(blocks, maxChars, locale)) {
		if (unit === 'break') {
			flush();
			continue;
		}
		if (alone || unit.alone || (pieces.length && length + 1 + unit.length > maxChars)) flush();
		const last = pieces.at(-1);
		if (last && last.block === unit.block) last.end = unit.end;
		else pieces.push({ block: unit.block, start: unit.start, end: unit.end });
		length += (length ? 1 : 0) + unit.length;
		alone = unit.alone;
		if (!alone && unit.paragraphEnd && length >= maxChars / 2) flush();
	}
	flush();
	return passages;
}

/** A web address, without the punctuation that ends its sentence. */
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,;:!?)\]'\u2019\u201D]/gi;

/**
 * What is sent to AllTalk for a passage. Web addresses become "a link": spelled out character
 * by character they are noise (they stay on the page).
 */
export function passageText(blocks: readonly Block[], passage: Passage): string {
	return passage.pieces
		.map(({ block, start, end }) => {
			const item = blocks[block];
			return item && item.type !== 'break' ? collapseWhitespace(item.text.slice(start, end)) : '';
		})
		.filter(Boolean)
		.join(' ')
		.replace(URL, 'a link');
}

/** The passage that reads the start of `block` (or the first one after it), or null. */
export function passageForBlock(passages: readonly Passage[], block: number): number | null {
	const index = passages.findIndex((passage) => passage.pieces.some((p) => p.block >= block));
	return index === -1 ? null : index;
}

/** The first block a passage reads: what is saved as the reader's place. */
export const firstBlock = (passage: Passage): number => passage.pieces[0].block;
