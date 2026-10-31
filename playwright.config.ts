import { defineConfig, devices } from '@playwright/test';

const ALLTALK_PORT = 7999;
const APP_PORT = 4173;
const LOCKED_PORT = 4174;
const shared = {
	ALLTALK_URL: `http://127.0.0.1:${ALLTALK_PORT}`,
	SEGMENT_MAX_CHARS: '120',
	UPLOAD_MAX_MB: '1'
};

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { baseURL: `http://127.0.0.1:${APP_PORT}`, trace: 'retain-on-failure' },
	projects: [
		{ name: 'api', testMatch: /api\.spec\.ts/ },
		{ name: 'iphone', testMatch: /ui\.spec\.ts/, use: { ...devices['iPhone 15'] } },
		{ name: 'android', testMatch: /ui\.spec\.ts/, use: { ...devices['Pixel 7'] } },
		{ name: 'desktop', testMatch: /ui\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }
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
		}
	]
});
