/**
 * Visual regression: the key screens in every theme, compared with the committed baselines in
 * `tests/visual/`. Local only (see playwright.config.ts). After a reviewed change, refresh the
 * baselines with `mise run visual:update`.
 *
 * The visual server has its own library, emptied before each test, and a fake AllTalk whose
 * passages last a minute, so every screen is the same on every run.
 */

import { expect, test, type Page } from '@playwright/test';
import {
	addBook,
	CAROL,
	emptyLibrary,
	JSON_HEADERS,
	MOBY,
	PRIDE,
	settle,
	useTheme
} from './books.js';

const LOCKED = 'http://127.0.0.1:4174';
const THEMES = ['light', 'dark', 'sepia'] as const;
const LONG_TITLE =
	'The Entirely Unplanned Consequences of Borrowing a Library Book in the Middle of a Thunderstorm';
/** The shelf: four books, one of them part read, one with the longest names we expect (AO3). */
async function stockLibrary(page: Page): Promise<string> {
	await addBook(page, LONG_TITLE, 'an_extremely_long_pseudonym_without_spaces', CAROL);
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

for (const theme of THEMES) {
	test.describe(theme, () => {
		test.beforeEach(async ({ page }) => {
			await useTheme(page, theme);
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
			// Pause and the highlight show while the audio is still loading; wait until it plays.
			await expect(page.getByText('Preparing the next passage')).toBeHidden();
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

		test('remove a book', async ({ page }) => {
			await addBook(page, LONG_TITLE, 'an_extremely_long_pseudonym_without_spaces', CAROL);
			await page.goto('/');
			await page.getByRole('button', { name: `Remove ${LONG_TITLE}` }).click();
			await expect(page.getByRole('alertdialog', { name: 'Remove this book?' })).toBeVisible();
			await settle(page);
			await expect(page).toHaveScreenshot(`${theme}-remove-book.png`);
		});

		test.describe(() => {
			// page.route can't see requests from a page a service worker controls.
			test.use({ serviceWorkers: 'block' });

			test('saving a chapter, then a problem', async ({ page }) => {
				const id = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
				// Two passages are prepared, then AllTalk stops answering: first the rule stands part
				// filled, then the save fails into a notice.
				let answered = 0;
				let fail = false;
				await page.route('**/api/speech', async (route) => {
					if (fail) {
						await route.fulfill({
							status: 503,
							json: { message: 'AllTalk isn\u2019t answering. Check that it\u2019s running.' }
						});
					} else if (answered++ < 2) await route.continue();
				});
				await page.goto(`/book/${id}`);
				const button = page.getByRole('button', { name: 'Contents' });
				const sheet = await button.isVisible();
				if (sheet) await button.click();
				const list = sheet
					? page.getByRole('dialog', { name: 'Contents' })
					: page.getByRole('navigation', { name: 'Contents' });
				await list.getByRole('button', { name: 'Save Chapter 1 for offline listening' }).click();
				await expect(list.getByText('2 of', { exact: false })).toBeVisible();
				// Not settle(): the third passage is held, so the network never goes quiet.
				await page.evaluate(() => document.fonts.ready);
				await expect(page).toHaveScreenshot(`${theme}-saving.png`);

				fail = true;
				await list.getByRole('button', { name: 'Stop saving Chapter 1' }).click();
				await list.getByRole('button', { name: 'Save Chapter 1 for offline listening' }).click();
				if (sheet) await list.getByRole('button', { name: 'Close' }).click();
				await expect(page.getByRole('list', { name: 'Problems' })).toContainText(
					'wasn\u2019t saved'
				);
				await settle(page);
				await expect(page).toHaveScreenshot(`${theme}-save-problem.png`);
			});
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
