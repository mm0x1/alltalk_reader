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

/**
 * The book's contents: a sheet on phones, the sidebar on desktop (always open). `close` closes
 * the sheet and does nothing on desktop.
 */
async function openContents(page: Page) {
	const button = page.getByRole('button', { name: 'Contents' });
	if (await button.isVisible()) {
		await button.click();
		const sheet = page.getByRole('dialog', { name: 'Contents' });
		return {
			list: sheet,
			sheet: true,
			close: () => sheet.getByRole('button', { name: 'Close' }).click()
		};
	}
	return {
		list: page.getByRole('navigation', { name: 'Contents' }),
		sheet: false,
		close: async () => {}
	};
}

/** The way back to the library: the header's back button, or the sidebar's on desktop. */
const libraryLink = (page: Page) => page.getByRole('link', { name: /^(Library|The shelf)$/ });

/**
 * Records every passage marked as being read from now on, as "<chapter heading>: <passage text>", however
 * fast playback runs: headless browsers without an audio device can finish a passage almost
 * instantly, too fast to catch by polling the page.
 */
async function recordPassages(page: Page): Promise<() => Promise<string[]>> {
	await page.evaluate(() => {
		const seen: string[] = [];
		(window as unknown as { seen: string[] }).seen = seen;
		const record = () => {
			const current = document.querySelector('article.page [aria-current="true"]');
			const text = `${document.querySelector('h1')?.textContent}: ${current?.textContent?.trim()}`;
			if (current && seen.at(-1) !== text) seen.push(text);
		};
		new MutationObserver(record).observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['aria-current']
		});
	});
	return () => page.evaluate(() => (window as unknown as { seen: string[] }).seen);
}

test('reads a pasted book aloud and keeps going between passages and chapters', async ({
	page
}, testInfo) => {
	const title = `Rain ${testInfo.project.name}`;
	await addPastedBook(page, title);

	const article = page.locator('article.page');
	await expect(article.getByText('The lamp was lit')).toBeVisible();

	const seen = await recordPassages(page);

	await page.getByRole('button', { name: 'Play' }).click();
	// It reads the passages in order and carries on into the next chapter by itself.
	await expect
		.poll(seen, { timeout: 20_000 })
		.toEqual(
			expect.arrayContaining([
				expect.stringMatching(/^Chapter 1: The lamp was lit/),
				expect.stringMatching(/^Chapter 1: A second paragraph/),
				expect.stringMatching(/^Chapter 2: Morning came grey/)
			])
		);
	const order = await seen();
	expect(order.findIndex((s) => s.includes('The lamp'))).toBeLessThan(
		order.findIndex((s) => s.includes('A second paragraph'))
	);
	expect(order.findIndex((s) => s.includes('A second paragraph'))).toBeLessThan(
		order.findIndex((s) => s.includes('Morning came'))
	);

	// Pause (or, if it already reached the end of the book, it has stopped by itself).
	const pause = page.getByRole('button', { name: 'Pause' });
	if (await pause.isVisible()) await pause.click();
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

	// Contents jumps to a chapter.
	const contents = await openContents(page);
	await contents.list.getByRole('button', { name: /^Chapter 3/ }).click();
	if (contents.sheet) await expect(contents.list).toBeHidden();
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 3' })).toBeVisible();

	// Back in the library the book shows its place, and the session continues in a mini player.
	await libraryLink(page).click();
	await expect(page.getByRole('link', { name: new RegExp(title) }).first()).toContainText(
		'Chapter 3 of 3'
	);
	await expect(page.getByRole('complementary', { name: 'Now reading' })).toContainText(title);
});

test('tapping a paragraph reads from there', async ({ page }, testInfo) => {
	await addPastedBook(page, `Tap ${testInfo.project.name}`);
	const seen = await recordPassages(page);
	await page.getByText('A second paragraph follows').click();
	await expect
		.poll(seen)
		.toEqual(expect.arrayContaining([expect.stringMatching(/^Chapter 1: A second paragraph/)]));
	expect((await seen()).some((s) => s.includes('The lamp'))).toBe(false);
	const pause = page.getByRole('button', { name: 'Pause' });
	if (await pause.isVisible()) await pause.click();
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

test('a saved chapter keeps playing without a connection', async ({ page, context }, testInfo) => {
	await addPastedBook(page, `Offline ${testInfo.project.name}`);
	// Let the service worker take control of the page first.
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();

	const contents = await openContents(page);
	await contents.list.getByRole('button', { name: 'Save Chapter 1 for offline listening' }).click();
	await expect(contents.list.getByRole('button', { name: /Chapter 1 is saved/ })).toBeVisible({
		timeout: 15_000
	});
	await contents.close();

	const seen = await recordPassages(page);
	await context.setOffline(true);
	try {
		await page.getByRole('button', { name: 'Play' }).click();
		await expect
			.poll(seen, { timeout: 15_000 })
			.toEqual(
				expect.arrayContaining([
					expect.stringMatching(/^Chapter 1: The lamp was lit/),
					expect.stringMatching(/^Chapter 1: A second paragraph/)
				])
			);
		await expect(page.getByRole('alert')).toHaveCount(0);
	} finally {
		await context.setOffline(false);
	}
});

test('a file or link shared from another app arrives in the library', async ({
	page
}, testInfo) => {
	await page.goto('/');
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();

	// What Android does with the manifest's share_target: a multipart POST to /share.
	const share = (fields: Record<string, string>, file?: { name: string; text: string }) =>
		page.evaluate(
			async ({ fields, file }) => {
				const form = new FormData();
				for (const [key, value] of Object.entries(fields)) form.append(key, value);
				if (file) form.append('book', new File([file.text], file.name, { type: 'text/plain' }));
				const response = await fetch('/share', { method: 'POST', body: form, redirect: 'manual' });
				return response.type === 'opaqueredirect' || response.redirected;
			},
			{ fields, file }
		);

	const title = `Shared ${testInfo.project.name}`;
	expect(await share({}, { name: `${title}.txt`, text: STORY })).toBe(true);
	await page.goto('/?shared');
	// Offered, not added: any website could have posted it, so it waits for a tap.
	const sheet = page.getByRole('dialog', { name: 'Add a book' });
	await expect(sheet).toContainText(`${title}.txt`);
	await sheet.getByRole('button', { name: 'Add this book' }).click();
	await expect(page).toHaveURL(/\/book\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();

	// A bare link can't become a book; the sheet says what to do instead.
	expect(await share({ text: 'https://archiveofourown.org/works/1' })).toBe(true);
	await page.goto('/?shared');
	await expect(page.getByRole('dialog', { name: 'Add a book' })).toContainText(
		'can\u2019t open web links'
	);
	await expect(page).toHaveURL(/\/$/);
});

test('marks the sentence being read in a long paragraph', async ({ page }, testInfo) => {
	await page.goto('/');
	const long =
		'The first sentence is here and it is fairly long, to make the point. ' +
		'The second sentence follows on, and it is also long enough to need room. ' +
		'A third sentence closes the paragraph neatly.';
	const response = await page.request.post('/api/books/paste', {
		data: { title: `Long ${testInfo.project.name}`, text: `${long}\n\nAfter.` },
		headers: { 'content-type': 'application/json' }
	});
	const { id } = await response.json();
	await page.goto(`/book/${id}`);
	await page.getByRole('button', { name: 'Play' }).click();
	const speaking = page.locator('article.page .speaking');
	await expect(speaking.first()).toContainText(/sentence/);
	await page.getByRole('button', { name: /^(Pause|Play)$/ }).click();
});

test('the sleep timer can stop at the end of the chapter', async ({ page }, testInfo) => {
	await addPastedBook(page, `Sleep ${testInfo.project.name}`);
	await page.getByRole('button', { name: 'Sleep timer' }).click();
	await page
		.getByRole('dialog', { name: 'Sleep timer' })
		.getByRole('button', { name: 'End of chapter' })
		.click();
	await expect(page.getByRole('button', { name: 'Sleep timer: End of chapter' })).toBeVisible();
	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByText('Sleep timer: paused. Sleep well.')).toBeVisible({ timeout: 20_000 });
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sleep timer', exact: true })).toBeVisible();
});

test('keyboard: space plays and pauses, arrows move between passages', async ({
	page,
	isMobile
}, testInfo) => {
	test.skip(isMobile, 'Keyboard shortcuts are for desktop');
	await addPastedBook(page, `Keys ${testInfo.project.name}`);
	await page
		.locator('article.page')
		.click({ position: { x: 5, y: 5 } })
		.catch(() => undefined);
	await page.getByRole('button', { name: /^(Pause|Play)$/ }).focus();
	await page.locator('body').press('Escape');
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('article.page [aria-current="true"]')).toContainText(
		'A second paragraph'
	);
});
