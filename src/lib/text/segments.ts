/**
 * Splits a block's text into segments short enough for one TTS request.
 *
 * Pure and deterministic: the server and the reader call it with the same text and limit
 * and get the same segments, so a segment is addressed by its index alone.
 */

import { collapseWhitespace } from './normalize';

const segmenters = new Map<string, Intl.Segmenter>();

function sentenceSegmenter(locale: string): Intl.Segmenter {
	let segmenter = segmenters.get(locale);
	if (!segmenter) {
		segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
		segmenters.set(locale, segmenter);
	}
	return segmenter;
}

/** Joins pieces greedily into chunks of at most `max` characters. Pieces must fit already. */
function pack(pieces: readonly string[], max: number): string[] {
	const chunks: string[] = [];
	let current = '';
	for (const piece of pieces) {
		const candidate = current ? `${current} ${piece}` : piece;
		if (candidate.length <= max) {
			current = candidate;
		} else {
			if (current) chunks.push(current);
			current = piece;
		}
	}
	if (current) chunks.push(current);
	return chunks;
}

function hardCut(word: string, max: number): string[] {
	const parts: string[] = [];
	for (let i = 0; i < word.length; i += max) parts.push(word.slice(i, i + max));
	return parts;
}

/** Breaks one over-long sentence at clause punctuation, then at spaces, then anywhere. */
function splitLongSentence(sentence: string, max: number): string[] {
	const clauses = sentence.split(/(?<=[,;:\u2013\u2014])\s+/).filter(Boolean);
	return pack(
		clauses.flatMap((clause) =>
			clause.length <= max
				? [clause]
				: clause
						.split(' ')
						.filter(Boolean)
						.flatMap((word) => (word.length <= max ? [word] : hardCut(word, max)))
		),
		max
	);
}

export function splitIntoSegments(text: string, maxChars: number, locale = 'en'): string[] {
	if (!Number.isInteger(maxChars) || maxChars < 20) {
		throw new RangeError(`maxChars must be an integer of at least 20, got ${maxChars}`);
	}
	const clean = collapseWhitespace(text);
	if (clean.length === 0) return [];
	if (clean.length <= maxChars) return [clean];

	const sentences = Array.from(sentenceSegmenter(locale).segment(clean), (s) => s.segment.trim())
		.filter(Boolean)
		.flatMap((sentence) =>
			sentence.length <= maxChars ? [sentence] : splitLongSentence(sentence, maxChars)
		);
	return pack(sentences, maxChars);
}
