/** Cleans text from any source (files, paste, EPUB) into consistent, speakable Unicode. */

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
// C0 controls except tab and newline, plus DEL and C1 controls.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
const ODD_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

/** Normalizes line endings, invisible characters and exotic spaces. Keeps tabs and newlines. */
export function normalizeText(input: string): string {
	return input
		.normalize('NFC')
		.replace(/\r\n?|\u2028|\u2029/g, '\n')
		.replace(ZERO_WIDTH, '')
		.replace(CONTROL, '')
		.replace(ODD_SPACES, ' ');
}

/** Collapses all whitespace runs (including newlines) to single spaces. */
export function collapseWhitespace(input: string): string {
	return input.replace(/\s+/g, ' ').trim();
}

/** Collapses whitespace but keeps single line breaks (for verse and `<br>`). */
export function collapseKeepingLines(input: string): string {
	return input
		.split('\n')
		.map(collapseWhitespace)
		.filter((line) => line.length > 0)
		.join('\n');
}
