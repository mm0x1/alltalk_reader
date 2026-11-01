/**
 * Extracts the story from text copied off an AO3 work page (select all, copy, paste).
 *
 * Keeps the chapter title, summary, notes and chapter text; drops navigation, tags and the
 * footer. AO3 page markers live in one place below so a change on AO3's side is a one-line fix.
 */

import { collapseWhitespace, normalizeText } from './normalize';

const MARKERS = {
	summary: 'Summary:',
	notes: 'Notes:',
	chapterText: 'Chapter Text',
	workText: 'Work Text:',
	end: ['Actions', 'Kudos', 'Comments'],
	chapterTitle: /^Chapter\s+\d+(?::\s*.+)?$/i
};

const DETECTION = [
	/Archive of Our Own/i,
	/archiveofourown\.org/i,
	/^Work Header$/m,
	/^Rating:\s*$/m,
	/^Additional Tags:\s*$/m,
	/^Stats:\s*$/m
];

const NOISE = [
	/^Main Content$/,
	/^Archive of Our Own/,
	/^Hi,\s+\S+!$/,
	/^(?:Post|Log Out|Log In|Fandoms|Browse|Search|About)$/,
	/^Entire Work$/,
	/^(?:Next|Previous) Chapter/,
	/^Chapter Index$/,
	/^(?:Bookmark|Share|Download|Comments)$/,
	/^\d+\s+characters left$/,
	/^\(See the end of the (?:chapter|work) for (?:more )?notes\.\)$/
];

/** The first line of the preface page in AO3's own downloads. */
export const AO3_PREFACE = /Posted originally on the Archive of Our Own/i;

/** Lines AO3 adds around a work that are not the author's words, in downloads and pages. */
const AO3_BOILERPLATE = [
	/^\(?See the end of the (?:chapter|work) for (?:more )?notes\.?\)?$/i,
	/^Please drop by the Archive and comment to let the creator know if you enjoyed their work!?$/i
];

export const isAo3Boilerplate = (line: string): boolean =>
	AO3_BOILERPLATE.some((pattern) => pattern.test(line.trim()));

export function looksLikeAo3(text: string): boolean {
	return DETECTION.filter((pattern) => pattern.test(text)).length >= 2;
}

export interface Ao3Extract {
	title: string | null;
	text: string;
}

/** Returns the story text, or null when the text isn't an AO3 page or has no story marker. */
export function extractAo3(raw: string): Ao3Extract | null {
	const text = normalizeText(raw);
	if (!looksLikeAo3(text)) return null;

	const lines = text.split('\n').map((line) => line.trimEnd());
	const start = lines.findIndex((line) => {
		const t = line.trim();
		return t === MARKERS.summary || t === MARKERS.chapterText || t === MARKERS.workText;
	});
	if (start === -1) return null;

	let title: string | null = null;
	for (let i = start - 1; i >= Math.max(0, start - 6); i--) {
		const candidate = collapseWhitespace(lines[i]);
		if (MARKERS.chapterTitle.test(candidate)) {
			title = candidate;
			break;
		}
	}

	const kept: string[] = [];
	for (let i = start; i < lines.length; i++) {
		const t = lines[i].trim();
		if (MARKERS.end.includes(t) && kept.length > 0) break;
		if (t === MARKERS.chapterText || t === MARKERS.workText) {
			kept.push('');
			continue;
		}
		if (NOISE.some((pattern) => pattern.test(t))) continue;
		kept.push(lines[i]);
	}

	const story = kept
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return story ? { title, text: story } : null;
}
