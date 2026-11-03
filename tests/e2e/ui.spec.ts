/**
 * The main reading flow, on phone and desktop viewports, against the production build and the
 * fake AllTalk (short silent passages, so playback advances quickly).
 */

import { gzipSync } from 'node:zlib';
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
	// Screen readers hear that reading started, and each new chapter, but not every passage.
	const announced = page.locator('[data-player] [aria-live]');
	await expect(announced).toHaveText(/^Reading Chapter \d$/);
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
	if (await pause.isVisible()) {
		await pause.click();
		await expect(announced).toHaveText('Paused');
	}
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

test('a pause right as a passage ends stays paused', async ({ page }, testInfo) => {
	// Keep hold of the player's audio element (it is never in the page) to finish a passage.
	await page.addInitScript(() => {
		const Native = window.Audio;
		window.Audio = function (src?: string) {
			const audio = new Native(src);
			(window as unknown as { playerAudio: HTMLAudioElement }).playerAudio = audio;
			return audio;
		} as unknown as typeof Audio;
	});
	await addPastedBook(page, `Pause ${testInfo.project.name}`);
	await page.getByRole('button', { name: 'Play' }).click();
	await expect(
		page.locator('article.page .speaking, article.page [aria-current="true"]').first()
	).toBeVisible();
	await expect(page.getByText('Preparing the next passage')).toBeHidden();

	await page.getByRole('button', { name: 'Pause' }).click();
	// The passage's own end arrives just after the tap, as it can on a phone.
	await page.evaluate(() =>
		(window as unknown as { playerAudio: HTMLAudioElement }).playerAudio.dispatchEvent(
			new Event('ended')
		)
	);
	// Long enough for a wrongly started passage to load and play, too short for it to finish.
	await page.waitForTimeout(400);
	expect(
		await page.evaluate(
			() => (window as unknown as { playerAudio: HTMLAudioElement }).playerAudio.paused
		)
	).toBe(true);
	await expect(page.locator('[data-player] [aria-live]')).toHaveText('Paused');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test.describe(() => {
	// page.route can't see requests from a page a service worker controls.
	test.use({ serviceWorkers: 'block' });

	test('short dialogue is read together, and passage length is a setting', async ({
		page
	}, testInfo) => {
		const dialogue = [
			'\u201cYou came back.\u201d',
			'',
			'\u201cI said I would.\u201d',
			'',
			'\u201cYou say a lot of things.\u201d',
			'',
			'She laughed.',
			'',
			'The rain had stopped by the time they walked down to the harbour, and the lamps along the quay were coming on one by one.'
		].join('\n');
		await page.goto('/');
		await page.getByRole('button', { name: 'Add a book' }).click();
		const sheet = page.getByRole('dialog', { name: 'Add a book' });
		await sheet.getByPlaceholder('Title (optional)').fill(`Dialogue ${testInfo.project.name}`);
		await sheet.getByPlaceholder('Paste here').fill(dialogue);
		await sheet.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page).toHaveURL(/\/book\//);
		const reader = page.url();
		const chars: number[] = [];
		await page.route('**/api/speech', async (route) => {
			chars.push((route.request().postDataJSON() as { chars: number }).chars);
			await route.continue();
		});

		// Four short paragraphs, one passage: all of them are marked as the place to read from.
		const marked = page.locator('article.page p:has(.speaking)');
		await expect(marked).toHaveCount(4);
		await expect(marked.first()).toContainText('You came back.');
		await expect(marked.last()).toContainText('She laughed.');
		await page.getByRole('button', { name: 'Play' }).click();
		await expect.poll(() => chars.length).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Pause' }).click();
		expect(new Set(chars)).toEqual(new Set([125]));

		// A shorter length, saved for the library, is what the reader asks for next time.
		await page.goto('/settings');
		await page.getByLabel('Passage length').fill('60');
		await page.getByRole('button', { name: 'Save voice' }).click();
		await expect(page.getByText('Saved.')).toBeVisible();
		chars.length = 0;
		await page.goto(reader);
		await page.getByRole('button', { name: 'Play' }).click();
		await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
		await expect.poll(() => chars.length).toBeGreaterThan(0);
		expect(new Set(chars)).toEqual(new Set([60]));
		await page.getByRole('button', { name: 'Pause' }).click();

		// Back to the default for the other tests.
		await page.goto('/settings');
		await page.getByLabel('Passage length').fill('125');
		await page.getByRole('button', { name: 'Save voice' }).click();
		await expect(page.getByText('Saved.')).toBeVisible();
	});

	test('how much audio is prepared ahead is a setting', async ({ page }, testInfo) => {
		await addPastedBook(page, `Buffer ${testInfo.project.name}`);
		const reader = page.url();
		const priorities: string[] = [];
		await page.route('**/api/speech', async (route) => {
			priorities.push((route.request().postDataJSON() as { priority: string }).priority);
			await route.continue();
		});
		const listen = async () => {
			priorities.length = 0;
			await page.goto(reader);
			await page.getByRole('button', { name: 'Play' }).click();
			await expect(page.getByText('Preparing the next passage')).toBeHidden();
			await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
			await page.waitForTimeout(300);
			await page.getByRole('button', { name: 'Pause' }).click();
			return [...priorities];
		};

		// One passage ahead, started at once: the passage itself, then one prepared behind it.
		await page.goto('/settings');
		await page.getByLabel('Prepare ahead').fill('1');
		await expect(page.getByText(/1 passage, about \d+ s/)).toBeVisible();
		expect(await listen()).toEqual(['now', 'soon']);

		// Two ahead, both ready before playing: the wait asks for them first.
		await page.goto('/settings');
		await page.getByLabel('Prepare ahead').fill('2');
		await page.getByLabel('Before playing, have ready').fill('2');
		await expect(page.getByText('2 more passages')).toBeVisible();
		expect((await listen()).slice(0, 3)).toEqual(['now', 'now', 'now']);
	});
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

test('following the voice scrolls without gliding when motion is reduced', async ({
	page
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => {
		const behaviours: string[] = [];
		(window as unknown as { behaviours: string[] }).behaviours = behaviours;
		const scroll = Element.prototype.scrollIntoView;
		Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
			if (typeof options === 'object') behaviours.push(options.behavior ?? 'auto');
			return scroll.call(this, options);
		};
	});
	await addPastedBook(page, `Still ${testInfo.project.name}`);
	await page.getByText('A second paragraph follows').click();
	const behaviours = () =>
		page.evaluate(() => (window as unknown as { behaviours: string[] }).behaviours);
	await expect.poll(behaviours).toContain('instant');
	expect(await behaviours()).not.toContain('smooth');
	const pause = page.getByRole('button', { name: 'Pause' });
	if (await pause.isVisible()) await pause.click();
});

test('the desktop sidebar shows the chapter being read in the middle', async ({
	page
}, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'The sidebar is the desktop layout');
	const chapters = Array.from(
		{ length: 40 },
		(_, i) => `Chapter ${i + 1}\n\nThe ${i + 1}th chapter, with a title long enough to wrap.`
	);
	const added = await page.request.post('/api/books/paste', {
		data: { title: `Sidebar ${testInfo.project.name}`, text: chapters.join('\n\n') },
		headers: { 'content-type': 'application/json' }
	});
	const { id } = (await added.json()) as { id: string };
	const placed = await page.request.put(`/api/books/${id}/progress`, {
		data: { chapter: 30, block: 0 },
		headers: { 'content-type': 'application/json' }
	});
	expect(placed.status()).toBe(204);
	await page.goto(`/book/${id}`);
	const list = page.getByRole('navigation', { name: 'Contents' });
	const current = list.locator('[aria-current="true"]');
	await expect(current).toHaveText(/Chapter 31/);
	await expect
		.poll(async () => {
			const [box, row] = await Promise.all([list.boundingBox(), current.boundingBox()]);
			if (!box || !row) return Infinity;
			// Centred: chapters before and after it show too.
			return Math.abs(row.y + row.height / 2 - (box.y + box.height / 2)) / row.height;
		})
		.toBeLessThan(1);
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
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

	await page.getByRole('button', { name: 'Stop preparing audio' }).click();
	await expect(page.getByRole('list', { name: 'Notices' })).toContainText(
		'AllTalk stopped preparing audio.'
	);
});

test('AllTalk\u2019s model, low VRAM mode and voice previews from Settings', async ({ page }) => {
	await page.goto('/settings');
	const model = page.getByRole('combobox', { name: 'Model' });
	// The fake AllTalk is shared by every test: start from XTTS whatever ran before.
	await expect(model).toBeEnabled();
	if ((await model.inputValue()) !== 'xtts - xttsv2_2.0.3') {
		await model.selectOption('xtts - xttsv2_2.0.3');
		await expect(page.getByText(/Connected.*\u00b7 xtts - xttsv2_2\.0\.3/)).toBeVisible();
	}

	await model.selectOption('apitts - xttsv2_2.0.3');
	await expect(page.getByRole('list', { name: 'Notices' })).toContainText(
		'AllTalk is using apitts - xttsv2_2.0.3.'
	);
	await expect(page.getByText(/Connected.*\u00b7 apitts - xttsv2_2\.0\.3/)).toBeVisible();
	await model.selectOption('xtts - xttsv2_2.0.3');
	await expect(page.getByText(/Connected.*\u00b7 xtts - xttsv2_2\.0\.3/)).toBeVisible();

	// Low VRAM applies at once and is what AllTalk then reports.
	await page.locator('section').filter({ hasText: 'Low VRAM' }).getByText('Advanced').click();
	const lowVram = page.getByRole('checkbox', { name: 'Low VRAM mode' });
	await lowVram.check();
	await page.reload();
	await page.locator('section').filter({ hasText: 'Low VRAM' }).getByText('Advanced').click();
	await expect(lowVram).toBeChecked();
	await lowVram.uncheck();

	// A voice can be heard before it is chosen.
	await page.getByRole('combobox', { name: 'Voice', exact: true }).selectOption('male_01.wav');
	const sample = page.waitForResponse('**/api/alltalk/preview');
	await page.getByRole('button', { name: 'Hear this voice' }).click();
	const response = await sample;
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toMatch(/^audio\//);
	await page.getByRole('combobox', { name: 'Voice', exact: true }).selectOption('');
});

test('the whole book can be prepared ahead, and forgotten', async ({ page }, testInfo) => {
	await addPastedBook(page, `Whole ${testInfo.project.name}`);
	const contents = await openContents(page);
	const whole = contents.list.getByRole('region', { name: 'Audiobook' });
	await whole.getByRole('button', { name: 'Make the audiobook' }).click();
	// The fake AllTalk is quick: it soon says what the audiobook was made with.
	await expect(whole).toContainText(
		/Audiobook made with AllTalk\u2019s default voice, xtts - xttsv2_2\.0\.3/,
		{
			timeout: 15_000
		}
	);
	await expect(whole).toContainText('Plays even with AllTalk off.');
	await whole.getByRole('button', { name: 'Forget' }).click();
	await expect(whole.getByRole('button', { name: 'Make the audiobook' })).toBeVisible();
});

test('removing a book asks first', async ({ page }, testInfo) => {
	const title = `Remove ${testInfo.project.name}`;
	await addPastedBook(page, title);
	await page.goto('/');
	const remove = page.getByRole('button', { name: `Remove ${title}` });

	await remove.click();
	const question = page.getByRole('alertdialog', { name: 'Remove this book?' });
	await expect(question).toContainText(title);
	// The safe answer has focus, and Escape means no.
	await expect(question.getByRole('button', { name: 'Keep it' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(question).toBeHidden();
	await expect(remove).toBeVisible();

	await remove.click();
	await question.getByRole('button', { name: 'Remove the book' }).click();
	await expect(remove).toHaveCount(0);
});

test('text can be made larger or smaller on this device', async ({ page }, testInfo) => {
	await addPastedBook(page, `Large ${testInfo.project.name}`);
	const reader = page.url();
	const size = () =>
		page
			.locator('article.page p')
			.first()
			.evaluate((p) => getComputedStyle(p).fontSize);
	expect(await size()).toBe('20px');

	await page.goto('/settings');
	await page.getByRole('radio', { name: 'Extra large' }).check();
	await page.goto(reader);
	expect(await size()).toBe('25px');
	await page.reload();
	expect(await size()).toBe('25px');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
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
	// Said again outside Contents, where it would otherwise go unseen.
	const notice = page.getByRole('list', { name: 'Notices' }).getByRole('listitem');
	await expect(notice).toHaveText(/Chapter 1 is saved for listening offline\./);
	await notice.getByRole('button', { name: 'Dismiss' }).click();
	await expect(notice).toHaveCount(0);

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

test('a share to a locked device waits through unlocking', async ({ page }, testInfo) => {
	const locked = 'http://127.0.0.1:4174';
	await page.goto(`${locked}/unlock`);
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();

	const name = `Locked share ${testInfo.project.name}.txt`;
	await page.evaluate(
		async ({ name, text }) => {
			const form = new FormData();
			form.append('book', new File([text], name, { type: 'text/plain' }));
			await fetch('/share', { method: 'POST', body: form, redirect: 'manual' });
		},
		{ name, text: STORY }
	);
	await page.goto(`${locked}/?shared`);
	await expect(page).toHaveURL(/\/unlock\?next=/);
	await page.getByLabel('Passcode').fill('correct horse');
	await page.getByRole('button', { name: 'Unlock' }).click();
	await expect(page.getByRole('dialog', { name: 'Add a book' })).toContainText(name);
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

test('keyboard: after clicking a player button, space still plays and arrows still move', async ({
	page,
	isMobile
}, testInfo) => {
	test.skip(isMobile, 'Keyboard shortcuts are for desktop');
	await addPastedBook(page, `Clicked keys ${testInfo.project.name}`);
	const current = page.locator('article.page [aria-current="true"]');
	await page.getByRole('button', { name: 'Next passage' }).click();
	await expect(current).toContainText('A second paragraph');
	// Focus is still on Next: arrows move, and Space means play, not a second click on Next.
	await page.keyboard.press('ArrowLeft');
	await expect(current).toContainText('The lamp was lit');
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('keyboard: shortcuts never fire inside a sheet', async ({ page, isMobile }, testInfo) => {
	test.skip(isMobile, 'Keyboard shortcuts are for desktop');
	await addPastedBook(page, `Sheet keys ${testInfo.project.name}`);
	const current = page.locator('article.page [aria-current="true"]');
	await page.getByRole('button', { name: /^Reading speed/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Reading speed' });
	await expect(sheet).toBeVisible();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	await expect(current).toContainText('The lamp was lit');
});

test('the reader stays within its script budget', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'desktop', 'Same bundle on every device: measure once');
	await addPastedBook(page, `Budget ${testInfo.project.name}`);
	const reader = page.url();
	// A fresh page with the HTTP cache bypassed, so every script it needs is fetched again.
	const fresh = await page.context().browser()!.newPage();
	const scripts = new Map<string, number>();
	fresh.on('response', async (response) => {
		if (response.request().resourceType() !== 'script') return;
		scripts.set(response.url(), gzipSync(await response.body()).length);
	});
	await fresh.goto(reader);
	await expect(fresh.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();
	await fresh.waitForLoadState('networkidle');
	const total = [...scripts.values()].reduce((sum, size) => sum + size, 0);
	testInfo.annotations.push({
		type: 'budget',
		description: `${scripts.size} scripts, ${(total / 1024).toFixed(1)} KB gzipped`
	});
	// Backlog budget: initial JS for the reader at most 100 KB gzipped.
	expect(total).toBeLessThanOrEqual(100 * 1024);
	await fresh.close();
});
