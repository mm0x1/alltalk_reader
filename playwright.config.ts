import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const DEMO_ALLTALK_PORT = 7996;
const DEMO_PORT = 4176;
const shared = {
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
/** The presentation recording (`mise run demo`): passages at speaking pace, only when asked for. */
const demo = visual && !!process.env.DEMO;
/**
 * Locally every project gets servers of its own (a fake AllTalk, an open and a locked
 * Readhouse, each with its own library), so projects run side by side: tests change settings
 * and AllTalk state, and a shared server would let one project see another's changes. CI
 * runs one project per job, so there one set of servers is enough.
 */
const isolated = !process.env.CI;

type Stack = { alltalk: number; app: number; locked: number; dir: string };
const stacks = new Map<string, Stack>();
/** The servers a project talks to; projects in `group` share them. */
function stack(group: string): Stack {
	const key = isolated ? group : group.startsWith('visual') ? 'visual' : 'functional';
	let found = stacks.get(key);
	if (!found) {
		const base = 4300 + stacks.size * 10;
		found = { alltalk: base, app: base + 1, locked: base + 2, dir: `.e2e/${key}` };
		stacks.set(key, found);
	}
	return found;
}
/** A project's base URL, and the locked server's, which specs read with `lockedURL()`. */
function on(group: string) {
	const { app, locked } = stack(group);
	return {
		use: { baseURL: `http://127.0.0.1:${app}` },
		metadata: { locked: `http://127.0.0.1:${locked}` }
	};
}

const projects = [
	{ name: 'api', testMatch: /api\.spec\.ts/, ...on('api') },
	// Accessibility checks on one phone and the desktop: Android shows the same pages.
	{
		name: 'iphone',
		testMatch: /(ui|a11y)\.spec\.ts/,
		...on('iphone'),
		use: { ...devices['iPhone 15'], ...on('iphone').use }
	},
	{
		name: 'android',
		testMatch: /ui\.spec\.ts/,
		...on('android'),
		use: { ...devices['Pixel 7'], ...on('android').use }
	},
	{
		name: 'desktop',
		testMatch: /(ui|a11y)\.spec\.ts/,
		...on('desktop'),
		use: { ...devices['Desktop Chrome'], ...on('desktop').use }
	},
	...(visual
		? (
				[
					['visual-iphone', devices['iPhone 15']],
					['visual-android', devices['Pixel 7']],
					['visual-desktop', devices['Desktop Chrome']]
				] as const
			).map(([name, device]) => ({
				name,
				testMatch: /visual\.spec\.ts/,
				...on(name),
				use: { ...device, ...on(name).use }
			}))
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
	// The README shots use the visual servers.
	...(shots
		? [
				{
					name: 'readme-phone',
					testMatch: /readme\.spec\.ts/,
					...on('visual-iphone'),
					use: { ...devices['iPhone 15'], deviceScaleFactor: 2, ...on('visual-iphone').use }
				},
				{
					name: 'readme-desktop',
					testMatch: /readme\.spec\.ts/,
					...on('visual-desktop'),
					use: {
						...devices['Desktop Chrome'],
						viewport: { width: 1280, height: 800 },
						deviceScaleFactor: 2,
						...on('visual-desktop').use
					}
				}
			]
		: [])
];

type WebServer = NonNullable<Exclude<PlaywrightTestConfig['webServer'], unknown[]>>;

/** Every stack's servers. The first open server builds the app; Playwright starts them in order. */
const servers = [...stacks.entries()].flatMap(
	([key, { alltalk, app, locked, dir }], i): WebServer[] => {
		// Visual passages last a minute, so a "playing" screen holds still for its screenshot.
		const still = key.startsWith('visual');
		const ALLTALK_URL = `http://127.0.0.1:${alltalk}`;
		return [
			{
				command: `node tests/fake-alltalk.ts ${alltalk}`,
				url: `${ALLTALK_URL}/api/ready`,
				env: still ? { FAKE_DELAY_MS: '0', FAKE_MIN_SECONDS: '60' } : { FAKE_DELAY_MS: '50' },
				reuseExistingServer: false
			},
			{
				command: i === 0 ? 'rm -rf .e2e && vite build && node build' : 'node build',
				url: `http://127.0.0.1:${app}/api/status`,
				env: {
					...(still ? { BODY_SIZE_LIMIT: 'Infinity', REFERENCE_PAGE: '1' } : shared),
					ALLTALK_URL,
					PORT: String(app),
					HOST: '127.0.0.1',
					DATA_DIR: `${dir}/open`
				},
				reuseExistingServer: false,
				...(i === 0 && { timeout: 180_000 })
			},
			{
				command: 'node build',
				url: `http://127.0.0.1:${locked}/api/status`,
				env: {
					...shared,
					ALLTALK_URL,
					PORT: String(locked),
					HOST: '127.0.0.1',
					DATA_DIR: `${dir}/locked`,
					ACCESS_PASSCODE: 'correct horse'
				},
				reuseExistingServer: false
			}
		];
	}
);

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: isolated ? '50%' : 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { trace: 'retain-on-failure' },
	snapshotPathTemplate: 'tests/visual/{projectName}/{arg}{ext}',
	expect: {
		toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' }
	},
	projects,
	webServer: [
		...servers,
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
			: [])
	]
});
