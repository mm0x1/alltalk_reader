/**
 * Automated accessibility checks (axe, WCAG 2.2 A and AA) on every screen, in every theme, on a
 * phone and a desktop. They catch contrast, names, labels, landmarks and ARIA misuse; what a
 * screen reader actually says is checked by hand (device checklist).
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addBook, PRIDE, settle, useTheme } from './books.js';

const THEMES = ['light', 'dark', 'sepia'] as const;

/**
 * No violations, and no contrast left unchecked, once transitions have ended. The page frame is hidden first: it is
 * transparent inside, but it lies over the whole page, so axe couldn't tell any text's
 * background through it and would skip every contrast check.
 */
async function expectNoViolations(page: Page) {
	await settle(page);
	// Colours are measured where they settle, not halfway through a transition (a cancelled
	// one has settled too).
	await page.evaluate(() =>
		Promise.all(
			document
				.getAnimations()
				.filter((animation) => animation instanceof CSSTransition)
				.map((animation) => animation.finished.catch(() => {}))
		)
	);
	await page.evaluate(() =>
		document.querySelector<HTMLElement>('.frame')?.style.setProperty('display', 'none')
	);
	const { violations, incomplete } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
		.analyze();
	const unchecked = incomplete.filter((result) => result.id === 'color-contrast');
	expect(
		[...violations, ...unchecked].map(
			(v) =>
				`${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any[0]?.message ?? n.failureSummary})`).join(', ')}`
		)
	).toEqual([]);
}

for (const theme of THEMES) {
	test.describe(theme, () => {
		test.beforeEach(({ page }) => useTheme(page, theme));

		test('library and Add a book', async ({ page }) => {
			await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
			await page.goto('/');
			await expectNoViolations(page);
			await page.getByRole('button', { name: 'Add a book' }).click();
			await expect(page.getByRole('dialog', { name: 'Add a book' })).toBeVisible();
			await expectNoViolations(page);
		});

		test('reader, playing and paused, and Contents', async ({ page }) => {
			const id = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
			await page.goto(`/book/${id}`);
			// Beside the opening paragraph's drop cap axe can't place the marked sentence's
			// background, so reading starts at the next paragraph (the same colours).
			await page.getByText('However little known').click();
			await expect(page.locator('article.page .speaking')).toContainText('However');
			await expectNoViolations(page);
			await page.getByRole('button', { name: 'Pause' }).click();
			await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
			await expectNoViolations(page);
			const find = page.getByRole('button', { name: 'Find in the book' });
			if (await find.isVisible()) await find.click();
			else await page.keyboard.press('/');
			const sheet = page.getByRole('dialog', { name: 'Find in the book' });
			await sheet.getByRole('searchbox').fill('Bennet');
			await expect(sheet.getByRole('button', { name: /^Chapter 1/ }).first()).toBeVisible();
			await expectNoViolations(page);
			await page.keyboard.press('Escape');
			const contents = page.getByRole('button', { name: 'Contents' });
			if (await contents.isVisible()) {
				await contents.click();
				await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible();
				await expectNoViolations(page);
			}
		});

		test('Settings', async ({ page }) => {
			await page.goto('/settings');
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
			await expectNoViolations(page);
		});

		test('a missing book', async ({ page }) => {
			await page.goto('/book/00000000-0000-4000-8000-000000000000');
			await expectNoViolations(page);
		});
	});
}
