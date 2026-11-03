/**
 * The README demo video: about half a minute on a phone, in `docs/media/`. Not a test:
 * run `mise run demo` and watch the result before committing it. Uses its own server and a fake
 * AllTalk that speaks at a natural pace (silently: browser recordings have no sound).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addBook, CAROL, emptyLibrary, JSON_HEADERS, MOBY, PRIDE } from './books.js';

const OUT = 'docs/media';

/** Lets a moment register on screen before the next step. */
const beat = (page: Page, ms = 1200) => page.waitForTimeout(ms);

test('demo video', async ({ page }) => {
	await emptyLibrary(page);
	await addBook(page, 'Moby-Dick', 'Herman Melville', MOBY);
	await addBook(page, 'A Christmas Carol', 'Charles Dickens', CAROL);
	const frankenstein = await addBook(
		page,
		'Frankenstein',
		'Mary Shelley',
		'Letter 1\n\nYou will rejoice to hear that no disaster has accompanied the commencement of an enterprise.'
	);
	await page.request.put(`/api/books/${frankenstein}/progress`, {
		data: { chapter: 0, block: 0 },
		headers: JSON_HEADERS
	});
	const pride = await addBook(page, 'Pride and Prejudice', 'Jane Austen', PRIDE);
	// Opened once, so it waits on the shelf's continue plate.
	await page.goto(`/book/${pride}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();

	// The shelf.
	await page.goto('/');
	await page.evaluate(() => document.fonts.ready);
	await beat(page, 2000);

	// Open the book and listen: the sentence being read moves through the chapter.
	await page
		.getByRole('link', { name: /Pride and Prejudice/ })
		.first()
		.click();
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();
	await beat(page);
	await page.getByRole('button', { name: 'Play' }).click();
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
	await page.waitForTimeout(14_000);

	// Contents: save the next chapter for listening offline, then back to the page.
	await page.getByRole('button', { name: 'Contents' }).click();
	const contents = page.getByRole('dialog', { name: 'Contents' });
	await beat(page);
	await contents.getByRole('button', { name: 'Save Chapter 2 for offline listening' }).click();
	await expect(contents.getByRole('button', { name: /Chapter 2 is saved/ })).toBeVisible({
		timeout: 20_000
	});
	await beat(page, 800);
	await contents.getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('list', { name: 'Notices' })).toContainText('saved');
	await page.waitForTimeout(4000);

	// Find a passage from Contents, and go there.
	await page.getByRole('button', { name: 'Contents' }).click();
	const field = contents.getByRole('searchbox', { name: 'Find in the book' });
	await beat(page, 600);
	await field.click();
	await page.keyboard.type('Netherfield', { delay: 120 });
	await expect(contents.getByRole('status')).toContainText('place');
	await beat(page, 1500);
	await contents
		.getByRole('button', { name: /^Chapter 1/ })
		.first()
		.click();
	await expect(page.getByText('Your place is now here')).toBeVisible();
	await page.waitForTimeout(2500);
	await page.getByRole('button', { name: 'Play' }).click();
	await page.waitForTimeout(3000);

	// Night reading: the same page in the dark theme.
	await page.getByRole('button', { name: 'Pause' }).click();
	await page.getByRole('link', { name: 'Library' }).click();
	await page.getByRole('link', { name: 'Settings' }).click();
	await beat(page, 800);
	await page.getByRole('radio', { name: 'Dark' }).check();
	await beat(page);
	await page.getByRole('link', { name: 'Library' }).click();
	// The shelf, with the book still open in the mini player.
	await expect(page.getByRole('complementary', { name: 'Now reading' })).toBeVisible();
	await beat(page, 1500);
	await page.getByRole('complementary', { name: 'Now reading' }).getByRole('link').click();
	await expect(page.getByRole('heading', { level: 1, name: 'Chapter 1' })).toBeVisible();
	await page.getByRole('button', { name: 'Play' }).click();
	await page.waitForTimeout(3500);

	const video = page.video()!;
	const { width, height } = page.viewportSize()!;
	await page.close();
	mkdirSync(OUT, { recursive: true });
	const webm = `${OUT}/readhouse-phone.webm`;
	await video.saveAs(webm);
	// H.264 MP4 for slides and chat apps, which don't all play WebM.
	execFileSync('ffmpeg', [
		'-y',
		'-loglevel',
		'error',
		'-i',
		webm,
		// The recorder draws the page at its CSS size in the corner of the larger frame: cut it
		// out and scale it up to the frame, so the page fills the video.
		'-vf',
		`crop=${width}:${height}:0:0,scale=${width * 2}:${height * 2}:flags=lanczos`,
		'-c:v',
		'libx264',
		'-pix_fmt',
		'yuv420p',
		'-crf',
		'24',
		'-movflags',
		'+faststart',
		`${OUT}/readhouse-phone.mp4`
	]);
	rmSync(webm);
});
