/** Finds chapters in plain text by their headings ("Chapter 3", "PART TWO", "Stave I", "Prologue", "IV"). */

import type { ParsedChapter } from '#lib/book.js';
import { collapseWhitespace, normalizeText } from './normalize';
import { textToBlocks } from './paragraphs';

const NUMBER_WORDS =
	'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|' +
	'sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|' +
	'hundred|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|final';
const LABEL = '(?:chapter|chap\\.|part|book|volume|vol\\.|act|canto|stave)';
const NUMBER = `(?:\\d{1,4}|[ivxlcdm]{1,8}|the\\s+\\w+|(?:${NUMBER_WORDS})(?:[-\\s](?:${NUMBER_WORDS}))?)`;

/** "Chapter 1", "CHAPTER XII. The Storm", "Part Two: Ashes", "Book the First". */
const NAMED_HEADING = new RegExp(
	`^${LABEL}\\s+${NUMBER}\\b(?:\\s*[.:\\-\\u2013\\u2014]\\s*.{0,70}|\\s+.{0,70})?$`,
	'i'
);
/** A heading that is only a label and number ("CHAPTER I.") and may have a subtitle below. */
const NUMBER_ONLY_HEADING = new RegExp(`^${LABEL}\\s+${NUMBER}\\.?$`, 'i');
const SECTION_HEADING =
	/^(?:prologue|epilogue|interlude|preface|foreword|afterword|introduction|author'?s note)\b.{0,70}$/i;
/** A bare number or roman numeral on its own line ("IV", "12."). Only trusted in numbers. */
const BARE_NUMBER = /^(?:\d{1,3}|[IVXLCDM]{1,8})\.?$/;
const CONTENTS = /^(?:table of )?contents:?$/i;
/** Text before a chapter label, as in "He rode a black horse. CHAPTER III." */
const LABEL_IN_TEXT = new RegExp(`(?:^|\\s)(${LABEL}\\s+${NUMBER}\\b.*)$`, 'i');

const MAX_HEADING_LENGTH = 90;
const MAX_SUBTITLE_LENGTH = 70;
const MIN_BARE_HEADINGS = 3;

interface Heading {
	line: number;
	title: string;
	bare: boolean;
}

function isHeadingText(text: string): boolean {
	return NAMED_HEADING.test(text) || SECTION_HEADING.test(text);
}

/**
 * Tidies a chapter title from a table of contents: drops an illustration caption that some
 * publishers put before the chapter label.
 */
export function cleanChapterTitle(label: string): string {
	const title = collapseWhitespace(label);
	const match = LABEL_IN_TEXT.exec(title);
	return match && match.index > 0 ? match[1] : title;
}

function findHeadings(lines: readonly string[]): Heading[] {
	const headings: Heading[] = [];
	for (let i = 0; i < lines.length; i++) {
		const title = collapseWhitespace(lines[i]);
		if (!title || title.length > MAX_HEADING_LENGTH) continue;
		const blankBefore = i === 0 || lines[i - 1].trim() === '';
		const blankAfter = i === lines.length - 1 || lines[i + 1].trim() === '';
		if (!blankBefore) continue;
		if (isHeadingText(title)) {
			headings.push({ line: i, title, bare: false });
		} else if (blankAfter && BARE_NUMBER.test(title)) {
			headings.push({ line: i, title, bare: true });
		}
	}
	const bareCount = headings.filter((h) => h.bare).length;
	return bareCount >= MIN_BARE_HEADINGS ? headings : headings.filter((h) => !h.bare);
}

function sectionEnd(headings: readonly Heading[], index: number, lineCount: number): number {
	return headings[index + 1]?.line ?? lineCount;
}

/**
 * Removes a printed table of contents: headings with no text before the next heading, and
 * headings followed by a list of more chapter titles. Their lines are blanked so they don't
 * reappear as text, along with a "Contents" title just above them.
 */
function removeTableOfContents(headings: Heading[], lines: string[]): Heading[] {
	const kept: Heading[] = [];
	headings.forEach((heading, index) => {
		const body = lines.slice(heading.line + 1, sectionEnd(headings, index, lines.length));
		const nonBlank = body.filter((line) => line.trim() !== '');
		const listed = nonBlank.filter((line) => isHeadingText(collapseWhitespace(line))).length;
		const isContents = nonBlank.length === 0 || (listed >= 2 && listed >= nonBlank.length * 0.5);
		if (!isContents) {
			kept.push(heading);
			return;
		}
		lines[heading.line] = '';
		if (nonBlank.length > 0) {
			for (let i = heading.line + 1; i < sectionEnd(headings, index, lines.length); i++)
				lines[i] = '';
		}
		for (let i = heading.line - 1; i >= 0 && i >= heading.line - 3; i--) {
			if (CONTENTS.test(lines[i].trim())) lines[i] = '';
		}
	});
	return kept;
}

/** "Who Stole the Tarts?" reads as a title; "Run away now!" doesn't. */
function isTitleCase(text: string): boolean {
	const words = text.split(/\s+/).filter((word) => /\p{L}/u.test(word));
	const capitalised = words.filter((word) => /^\P{L}*\p{Lu}/u.test(word)).length;
	return words.length > 0 && capitalised >= words.length * 0.6;
}

/** "CHAPTER I." followed by a short standalone line "Down the Rabbit-Hole" becomes one title. */
function mergeSubtitle(heading: Heading, lines: string[], end: number): string {
	if (!NUMBER_ONLY_HEADING.test(heading.title) && !heading.bare) return heading.title;
	for (let i = heading.line + 1; i < Math.min(end, heading.line + 4); i++) {
		const text = collapseWhitespace(lines[i]);
		if (!text) continue;
		const standalone = i + 1 >= end || lines[i + 1].trim() === '';
		if (
			standalone &&
			text.length <= MAX_SUBTITLE_LENGTH &&
			!isHeadingText(text) &&
			(!/[.!?\u2026"\u201D\u2019)]$/.test(text) || (/[?!]$/.test(text) && isTitleCase(text)))
		) {
			lines[i] = '';
			return `${heading.title} ${text}`;
		}
		return heading.title;
	}
	return heading.title;
}

/**
 * Splits text into chapters. Text before the first heading becomes an "Opening" chapter if
 * it has content. With fewer than two headings the whole text is one chapter.
 */
export function splitChapters(text: string, fallbackTitle: string): ParsedChapter[] {
	const lines = normalizeText(text).split('\n');
	const headings = removeTableOfContents(findHeadings(lines), lines);

	if (headings.length < 2) {
		const blocks = textToBlocks(lines.join('\n'));
		return blocks.length > 0 ? [{ title: fallbackTitle, blocks }] : [];
	}

	const chapters: ParsedChapter[] = [];
	const opening = textToBlocks(lines.slice(0, headings[0].line).join('\n'));
	if (opening.length > 0) chapters.push({ title: 'Opening', blocks: opening });

	headings.forEach((heading, index) => {
		const end = sectionEnd(headings, index, lines.length);
		const title = mergeSubtitle(heading, lines, end);
		const blocks = textToBlocks(lines.slice(heading.line + 1, end).join('\n'));
		if (blocks.length > 0) chapters.push({ title, blocks });
	});
	return chapters;
}
