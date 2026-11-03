/**
 * The README screenshots, at 2x, in `docs/screenshots/`. Not a test: run `mise run screenshots`
 * after a visible change and review the images before committing them. Uses the visual server
 * (fake AllTalk with one-minute passages, so the playing state holds still).
 */

import { expect, test, type Page } from '@playwright/test';
import { addBook, emptyLibrary, JSON_HEADERS, PRIDE, settle, useTheme } from './books.js';

const OUT = 'docs/screenshots';

/** A book of `count` chapters, each opening with `line` (only the library shows these). */
function chapters(heading: string, count: number, line: string): string {
	return Array.from({ length: count }, (_, i) => `${heading} ${i + 1}\n\n${line}`).join('\n\n');
}

async function place(page: Page, id: string, chapter: number) {
	const response = await page.request.put(`/api/books/${id}/progress`, {
		data: { chapter, block: 0 },
		headers: JSON_HEADERS
	});
	expect(response.status()).toBe(204);
}

/** A believable shelf, most recently read first; returns Pride and Prejudice's id. */
async function shelf(page: Page): Promise<string> {
	await emptyLibrary(page);
	await addBook(
		page,
		'Middlemarch',
		'George Eliot',
		chapters(
			'Chapter',
			86,
			'Miss Brooke had that kind of beauty which seems to be thrown into relief by poor dress.'
		)
	);
	await addBook(
		page,
		'A Christmas Carol',
		'Charles Dickens',
		chapters('Chapter', 5, 'Marley was dead: to begin with.')
	);
	const frankenstein = await addBook(
		page,
		'Frankenstein',
		'Mary Shelley',
		chapters(
			'Chapter',
			24,
			'I am by birth a Genevese, and my family is one of the most distinguished of that republic.'
		)
	);
	await place(page, frankenstein, 6);
	const moby = await addBook(
		page,
		'Moby-Dick',
		'Herman Melville',
		chapters('Chapter', 135, 'Call me Ishmael.')
	);
	await place(page, moby, 11);
	await page.goto(`/book/${moby}`);
	await expect(page.locator('article.page')).toBeVisible();
	const pride = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
	await place(page, pride, 0);
	await page.goto(`/book/${pride}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();
	return pride;
}

/** The reader with the first passage being read aloud. */
async function playing(page: Page, id: string) {
	await page.goto(`/book/${id}`);
	await settle(page);
	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect(page.getByText('Preparing the next passage')).toBeHidden();
}

async function shoot(page: Page, name: string) {
	await settle(page);
	await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled', caret: 'hide' });
}

test.describe('phone', () => {
	test.skip(({ isMobile }) => !isMobile, 'Phone screenshots');

	test('library', async ({ page }) => {
		await useTheme(page, 'light');
		await shelf(page);
		await page.goto('/');
		await shoot(page, 'phone-library');
	});

	test('reader', async ({ page }) => {
		await useTheme(page, 'light');
		await playing(page, await shelf(page));
		await shoot(page, 'phone-reader');
	});

	test('reader, dark', async ({ page }) => {
		await useTheme(page, 'dark');
		await playing(page, await shelf(page));
		await shoot(page, 'phone-reader-dark');
	});

	test('contents, sepia', async ({ page }) => {
		await useTheme(page, 'sepia');
		await page.goto(`/book/${await shelf(page)}`);
		await page.getByRole('button', { name: 'Contents' }).click();
		await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible();
		await shoot(page, 'phone-contents-sepia');
	});

	test('find in the book', async ({ page }) => {
		await useTheme(page, 'light');
		await page.goto(`/book/${await shelf(page)}`);
		await page.getByRole('button', { name: 'Contents' }).click();
		const contents = page.getByRole('dialog', { name: 'Contents' });
		await contents.getByRole('searchbox', { name: 'Find in the book' }).fill('Mr. Bennet');
		await expect(contents.getByRole('status')).toContainText('places');
		await contents.getByRole('searchbox').blur();
		await shoot(page, 'phone-find');
	});
});

test.describe('desktop', () => {
	test.skip(({ isMobile }) => isMobile, 'Desktop screenshots');

	test('reader', async ({ page }) => {
		await useTheme(page, 'light');
		await playing(page, await shelf(page));
		await shoot(page, 'desktop-reader');
	});

	test('library, sepia', async ({ page }) => {
		await useTheme(page, 'sepia');
		await shelf(page);
		await page.goto('/');
		await shoot(page, 'desktop-library-sepia');
	});
});
