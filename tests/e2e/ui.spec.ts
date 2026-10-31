/**
 * The main reading flow, on phone and desktop viewports, against the production build and the
 * fake AllTalk (short silent passages, so playback advances quickly).
 */

import { expect, test, type Page } from '@playwright/test';

const STORY = [
	'Chapter 1',
	'',
	'The lamp was lit before the rain began. Everyone in the house could hear it on the roof.',
	'',
	'A second paragraph follows, short and sweet.',
	'',
	'Chapter 2',
	'',
	'Morning came grey and quiet.',
	'',
	'Chapter 3',
	'',
	'The end of the test story.'
].join('\n');

async function addPastedBook(page: Page, title: string) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Add a book' }).click();
	const sheet = page.getByRole('dialog', { name: 'Add a book' });
	await expect(sheet).toBeVisible();
	await sheet.getByPlaceholder('Title (optional)').fill(title);
	await sheet.getByPlaceholder('Paste here').fill(STORY);
	await sheet.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page).toHaveURL(/\/book\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();
}

test('reads a pasted book aloud and keeps going between passages and chapters', async ({
	page
}, testInfo) => {
	const title = `Rain ${testInfo.project.name}`;
	await addPastedBook(page, title);

	const article = page.locator('article.page');
	await expect(article.getByText('The lamp was lit')).toBeVisible();

	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	// The current passage is marked, and playback moves on by itself.
	await expect(article.locator('[aria-current="true"]')).toContainText('The lamp was lit');
	await expect(article.locator('[aria-current="true"]')).toContainText('A second paragraph', {
		timeout: 15_000
	});
	// ...and into the next chapter.
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 2' })).toBeVisible({
		timeout: 15_000
	});

	await page.getByRole('button', { name: 'Pause' }).click();
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

	// Contents jumps to a chapter.
	await page.getByRole('button', { name: 'Contents' }).click();
	const contents = page.getByRole('dialog', { name: 'Contents' });
	await contents.getByRole('button', { name: /Chapter 3/ }).click();
	await expect(contents).toBeHidden();
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 3' })).toBeVisible();

	// Back in the library the book shows its place, and the session continues in a mini player.
	await page.getByRole('link', { name: 'Library' }).click();
	await expect(page.getByRole('link', { name: new RegExp(title) }).first()).toContainText(
		'Chapter 3 of 3'
	);
	await expect(page.getByRole('complementary', { name: 'Now reading' })).toContainText(title);
});

test('tapping a paragraph reads from there', async ({ page }, testInfo) => {
	await addPastedBook(page, `Tap ${testInfo.project.name}`);
	await page.getByText('A second paragraph follows').click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await expect(page.locator('article.page [aria-current="true"]')).toContainText(
		'A second paragraph'
	);
	await page.getByRole('button', { name: 'Pause' }).click();
});

test('theme choice applies immediately and survives a reload', async ({ page }) => {
	await page.goto('/settings');
	await page.getByLabel('Sepia').check();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia');
	await page.getByLabel('Match device').check();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});

test('settings show AllTalk voices and save the voice', async ({ page }) => {
	await page.goto('/settings');
	await expect(page.getByText(/^Connected/)).toBeVisible();
	await page.getByRole('combobox', { name: 'Voice', exact: true }).selectOption('male_01.wav');
	await page.getByRole('button', { name: 'Save voice' }).click();
	await expect(page.getByText('Saved.')).toBeVisible();
	await page.reload();
	await expect(page.getByRole('combobox', { name: 'Voice', exact: true })).toHaveValue(
		'male_01.wav'
	);
	await page.getByRole('combobox', { name: 'Voice', exact: true }).selectOption('');
	await page.getByRole('button', { name: 'Save voice' }).click();
});

test('pages fit the screen without sideways scrolling', async ({ page }, testInfo) => {
	await addPastedBook(page, `Fit ${testInfo.project.name}`);
	for (const path of ['/', '/settings', page.url()]) {
		await page.goto(path);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, path).toBeLessThanOrEqual(0);
	}
});
