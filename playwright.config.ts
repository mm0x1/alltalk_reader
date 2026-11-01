import { defineConfig, devices } from '@playwright/test';

const ALLTALK_PORT = 7999;
const APP_PORT = 4173;
const LOCKED_PORT = 4174;
const VISUAL_ALLTALK_PORT = 7998;
const VISUAL_PORT = 4175;
const DEMO_ALLTALK_PORT = 7996;
const DEMO_PORT = 4176;
const shared = {
	ALLTALK_URL: `http://127.0.0.1:${ALLTALK_PORT}`,
	// As `mise run start` does: Readhouse enforces its own limits.
	BODY_SIZE_LIMIT: 'Infinity',
	SEGMENT_MAX_CHARS: '120',
	UPLOAD_MAX_MB: '1'
};

/**
 * Visual regression runs only on this machine (`mise run check` and the pre-push hook): the
 * baselines are made on macOS, and Linux CI renders fonts differently.
 */
const visual = !process.env.CI;
/** README screenshots (`mise run screenshots`): only when asked for, never in the gate. */
const shots = visual && !!process.env.SHOTS;
const visualUse = { baseURL: `http://127.0.0.1:${VISUAL_PORT}` };
/** The presentation recording (`mise run demo`): passages at speaking pace, only when asked for. */
const demo = visual && !!process.env.DEMO;

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { baseURL: `http://127.0.0.1:${APP_PORT}`, trace: 'retain-on-failure' },
	snapshotPathTemplate: 'tests/visual/{projectName}/{arg}{ext}',
	expect: {
		toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' }
	},
	projects: [
		{ name: 'api', testMatch: /api\.spec\.ts/ },
		{ name: 'iphone', testMatch: /ui\.spec\.ts/, use: { ...devices['iPhone 15'] } },
		{ name: 'android', testMatch: /ui\.spec\.ts/, use: { ...devices['Pixel 7'] } },
		{ name: 'desktop', testMatch: /ui\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
		...(visual
			? [
					{
						name: 'visual-iphone',
						testMatch: /visual\.spec\.ts/,
						use: { ...devices['iPhone 15'], ...visualUse }
					},
					{
						name: 'visual-android',
						testMatch: /visual\.spec\.ts/,
						use: { ...devices['Pixel 7'], ...visualUse }
					},
					{
						name: 'visual-desktop',
						testMatch: /visual\.spec\.ts/,
						use: { ...devices['Desktop Chrome'], ...visualUse }
					}
				]
			: []),
		...(demo
			? [
					{
						name: 'demo',
						testMatch: /demo\.spec\.ts/,
						timeout: 180_000,
						use: {
							...devices['iPhone 15'],
							baseURL: `http://127.0.0.1:${DEMO_PORT}`,
							video: { mode: 'on' as const, size: { width: 786, height: 1318 } }
						}
					}
				]
			: []),
		...(shots
			? [
					{
						name: 'readme-phone',
						testMatch: /readme\.spec\.ts/,
						use: { ...devices['iPhone 15'], deviceScaleFactor: 2, ...visualUse }
					},
					{
						name: 'readme-desktop',
						testMatch: /readme\.spec\.ts/,
						use: {
							...devices['Desktop Chrome'],
							viewport: { width: 1280, height: 800 },
							deviceScaleFactor: 2,
							...visualUse
						}
					}
				]
			: [])
	],
	webServer: [
		{
			command: `node tests/fake-alltalk.ts ${ALLTALK_PORT}`,
			url: `http://127.0.0.1:${ALLTALK_PORT}/api/ready`,
			env: { FAKE_DELAY_MS: '50' },
			reuseExistingServer: false
		},
		{
			command: 'rm -rf .e2e && vite build && node build',
			url: `http://127.0.0.1:${APP_PORT}/api/status`,
			env: { ...shared, PORT: String(APP_PORT), HOST: '127.0.0.1', DATA_DIR: '.e2e/open' },
			reuseExistingServer: false,
			timeout: 180_000
		},
		{
			command: 'node build',
			url: `http://127.0.0.1:${LOCKED_PORT}/api/status`,
			env: {
				...shared,
				PORT: String(LOCKED_PORT),
				HOST: '127.0.0.1',
				DATA_DIR: '.e2e/locked',
				ACCESS_PASSCODE: 'correct horse'
			},
			reuseExistingServer: false
		},
		...(demo
			? [
					{
						command: `node tests/fake-alltalk.ts ${DEMO_ALLTALK_PORT}`,
						url: `http://127.0.0.1:${DEMO_ALLTALK_PORT}/api/ready`,
						env: { FAKE_DELAY_MS: '700', FAKE_SECONDS_PER_CHAR: '0.05' },
						reuseExistingServer: false
					},
					{
						command: 'node build',
						url: `http://127.0.0.1:${DEMO_PORT}/api/status`,
						env: {
							ALLTALK_URL: `http://127.0.0.1:${DEMO_ALLTALK_PORT}`,
							PORT: String(DEMO_PORT),
							HOST: '127.0.0.1',
							DATA_DIR: '.e2e/demo',
							BODY_SIZE_LIMIT: 'Infinity'
						},
						reuseExistingServer: false
					}
				]
			: []),
		...(visual
			? [
					{
						// Passages last a minute, so a "playing" screen holds still for its screenshot.
						command: `node tests/fake-alltalk.ts ${VISUAL_ALLTALK_PORT}`,
						url: `http://127.0.0.1:${VISUAL_ALLTALK_PORT}/api/ready`,
						env: { FAKE_DELAY_MS: '0', FAKE_MIN_SECONDS: '60' },
						reuseExistingServer: false
					},
					{
						command: 'node build',
						url: `http://127.0.0.1:${VISUAL_PORT}/api/status`,
						env: {
							ALLTALK_URL: `http://127.0.0.1:${VISUAL_ALLTALK_PORT}`,
							PORT: String(VISUAL_PORT),
							HOST: '127.0.0.1',
							DATA_DIR: '.e2e/visual',
							BODY_SIZE_LIMIT: 'Infinity',
							REFERENCE_PAGE: '1'
						},
						reuseExistingServer: false
					}
				]
			: [])
	]
});
