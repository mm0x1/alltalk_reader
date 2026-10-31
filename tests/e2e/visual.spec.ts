/**
 * Visual regression: the key screens in every theme, compared with the committed baselines in
 * `tests/visual/`. Local only (see playwright.config.ts). After a reviewed change, refresh the
 * baselines with `mise run visual:update`.
 *
 * The visual server has its own library, emptied before each test, and a fake AllTalk whose
 * passages last a minute, so every screen is the same on every run.
 */

import { expect, test, type Page } from '@playwright/test';

const LOCKED = 'http://127.0.0.1:4174';
const THEMES = ['light', 'dark', 'sepia'] as const;

const JSON_HEADERS = { 'content-type': 'application/json' };

const PRIDE = [
	'Chapter 1',
	'',
	'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
	'',
	'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
	'',
	'"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"',
	'',
	'Mr. Bennet replied that he had not.',
	'',
	'"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."',
	'',
	'Mr. Bennet made no answer.',
	'',
	'"Do you not want to know who has taken it?" cried his wife impatiently.',
	'',
	'"You want to tell me, and I have no objection to hearing it."',
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

const MOBY = [
	'Chapter 1',
	'',
	'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, I thought I would sail about a little and see the watery part of the world.'
].join('\n');

const CAROL = [
	'Stave 1',
	'',
	'Marley was dead: to begin with. There is no doubt whatever about that.'
].join('\n');

async function addBook(page: Page, title: string, author: string, text: string): Promise<string> {
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

/** Empties the visual server's library, so each screen starts from the same books. */
async function emptyLibrary(page: Page) {
	const response = await page.request.get('/api/books');
	const books = (await response.json()) as { id: string }[];
	for (const { id } of books) {
		const deleted = await page.request.delete(`/api/books/${id}`, { headers: JSON_HEADERS });
		expect(deleted.status()).toBe(204);
	}
}

/** The shelf: four books, one of them part read, one with the longest names we expect (AO3). */
async function stockLibrary(page: Page): Promise<string> {
	await addBook(
		page,
		'The Entirely Unplanned Consequences of Borrowing a Library Book in the Middle of a Thunderstorm',
		'an_extremely_long_pseudonym_without_spaces',
		CAROL
	);
	await addBook(page, 'A Christmas Carol', 'Charles Dickens', CAROL);
	await addBook(page, 'Moby-Dick', 'Herman Melville', MOBY);
	const pride = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
	const placed = await page.request.put(`/api/books/${pride}/progress`, {
		data: { chapter: 0, block: 2 },
		headers: JSON_HEADERS
	});
	expect(placed.status()).toBe(204);
	// Opening it is what puts it in the library's continue plate.
	await page.goto(`/book/${pride}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();
	return pride;
}

async function settle(page: Page) {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForLoadState('networkidle');
}

for (const theme of THEMES) {
	test.describe(theme, () => {
		test.beforeEach(async ({ page }) => {
			await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
			await page.addInitScript((theme) => {
				localStorage.setItem('readhouse:theme', theme);
			}, theme);
			await emptyLibrary(page);
		});

		test('library, empty', async ({ page }) => {
			await page.goto('/');
			await settle(page);
			await expect(page).toHaveScreenshot(`${theme}-library-empty.png`);
		});

		test('library', async ({ page }) => {
			await stockLibrary(page);
			await page.goto('/');
			await settle(page);
			await expect(page).toHaveScreenshot(`${theme}-library.png`);
		});

		test('add a book', async ({ page }) => {
			await page.goto('/');
			await page.getByRole('button', { name: 'Add a book' }).click();
			await expect(page.getByRole('dialog', { name: 'Add a book' })).toBeVisible();
			await settle(page);
			await expect(page).toHaveScreenshot(`${theme}-add-book.png`);
		});

		test('reader', async ({ page }) => {
			const id = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
			await page.goto(`/book/${id}`);
			await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();
			await settle(page);
			await expect(page).toHaveScreenshot(`${theme}-reader.png`);
		});

		test('reader, playing', async ({ page }) => {
			const id = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
			await page.goto(`/book/${id}`);
			await settle(page);
			await page.getByRole('button', { name: 'Play' }).click();
			await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
			await expect(page.locator('article.page .speaking').first()).toBeVisible();
			await expect(page).toHaveScreenshot(`${theme}-reader-playing.png`);
			// Paused looks like the reader screen above (the passage is tinted), so no second shot.
			await page.getByRole('button', { name: 'Pause' }).click();
		});

		test('contents', async ({ page }) => {
			const id = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
			await page.goto(`/book/${id}`);
			const button = page.getByRole('button', { name: 'Contents' });
			test.skip(!(await button.isVisible()), 'On desktop the contents are in the reader');
			await button.click();
			await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible();
			await settle(page);
			await expect(page).toHaveScreenshot(`${theme}-contents.png`);
		});

		test('settings', async ({ page }) => {
			await page.goto('/settings');
			await expect(page.getByText(/^Connected/)).toBeVisible();
			await settle(page);
			// The frame is fixed to the viewport, so full-page captures break it: top, then bottom.
			await expect(page).toHaveScreenshot(`${theme}-settings.png`);
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			await expect(page).toHaveScreenshot(`${theme}-settings-end.png`);
		});

		test('unlock', async ({ page }) => {
			await page.goto(`${LOCKED}/unlock`);
			await settle(page);
			await expect(page).toHaveScreenshot(`${theme}-unlock.png`);
		});
	});
}
