/**
 * Books and helpers shared by the screenshot specs (visual regression and README shots). The
 * texts are public domain.
 */

import { expect, test, type Page } from '@playwright/test';

export type Theme = 'light' | 'dark' | 'sepia';

export const JSON_HEADERS = { 'content-type': 'application/json' };

export const PRIDE = [
	'Chapter 1',
	'',
	'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
	'',
	'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
	'',
	'\u201cMy dear Mr. Bennet,\u201d said his lady to him one day, \u201chave you heard that Netherfield Park is let at last?\u201d',
	'',
	'Mr. Bennet replied that he had not.',
	'',
	'\u201cBut it is,\u201d returned she; \u201cfor Mrs. Long has just been here, and she told me all about it.\u201d',
	'',
	'Mr. Bennet made no answer.',
	'',
	'\u201cDo you not want to know who has taken it?\u201d cried his wife impatiently.',
	'',
	'\u201cYou want to tell me, and I have no objection to hearing it.\u201d',
	'',
	'This was invitation enough.',
	'',
	'Chapter 2',
	'',
	'Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go.',
	'',
	'Chapter 3',
	'',
	'Not all that Mrs. Bennet, however, with the assistance of her five daughters, could ask on the subject, was sufficient to draw from her husband any satisfactory description of Mr. Bingley.'
].join('\n');

export const MOBY = [
	'Chapter 1',
	'',
	'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, I thought I would sail about a little and see the watery part of the world.'
].join('\n');

export const CAROL = [
	'Stave 1',
	'',
	'Marley was dead: to begin with. There is no doubt whatever about that.'
].join('\n');

export async function addBook(
	page: Page,
	title: string,
	author: string,
	text: string
): Promise<string> {
	const response = await page.request.post('/api/books/paste', {
		data: { title, text },
		headers: JSON_HEADERS
	});
	expect(response.status()).toBe(201);
	const { id } = (await response.json()) as { id: string };
	const renamed = await page.request.patch(`/api/books/${id}`, {
		data: { title, author },
		headers: JSON_HEADERS
	});
	expect(renamed.status()).toBe(204);
	return id;
}

/** Empties the library, so each screen starts from the same books. */
export async function emptyLibrary(page: Page) {
	const response = await page.request.get('/api/books');
	const books = (await response.json()) as { id: string }[];
	for (const { id } of books) {
		const deleted = await page.request.delete(`/api/books/${id}`, { headers: JSON_HEADERS });
		expect(deleted.status()).toBe(204);
	}
}

/** Fonts loaded and the network quiet, so a screenshot shows the finished page. */
export async function settle(page: Page) {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForLoadState('networkidle');
}

/** Shows every page in `theme`, as if chosen in Settings on this device. */
export async function useTheme(page: Page, theme: Theme) {
	await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
	await page.addInitScript((theme) => {
		localStorage.setItem('readhouse:theme', theme);
	}, theme);
}

/** The locked server (passcode "correct horse") that belongs with this project's servers. */
export const lockedURL = () => test.info().project.metadata.locked as string;
