import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Access, sessionCookieOptions } from './access.js';

const dirs: string[] = [];
function dataDir() {
	const dir = mkdtempSync(join(tmpdir(), 'readhouse-access-'));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Access', () => {
	it('lets everyone in when no passcode is set', () => {
		const access = new Access(undefined, dataDir());
		expect(access.required).toBe(false);
		expect(access.verify(undefined)).toBe(true);
	});

	it('issues cookies that verify, and rejects tampered ones', () => {
		const access = new Access('secret passcode', dataDir());
		const cookie = access.issue();
		expect(access.verify(cookie)).toBe(true);
		expect(access.verify(undefined)).toBe(false);
		expect(access.verify(cookie.slice(0, -2) + 'xx')).toBe(false);
		const [issued, signature] = cookie.split('.');
		expect(access.verify(`${Number(issued) + 1}.${signature}`)).toBe(false);
		expect(access.verify('garbage')).toBe(false);
	});

	it('expires sessions and refuses ones from the future', () => {
		const access = new Access('secret passcode', dataDir());
		const now = Date.now();
		const old = access.issue(now - 91 * 86_400_000);
		expect(access.verify(old, now)).toBe(false);
		expect(access.verify(access.issue(now + 3_600_000), now)).toBe(false);
	});

	it('signs everyone out when the passcode changes', () => {
		const dir = dataDir();
		const cookie = new Access('first passcode', dir).issue();
		expect(new Access('first passcode', dir).verify(cookie)).toBe(true);
		expect(new Access('second passcode', dir).verify(cookie)).toBe(false);
	});

	it('keeps its signing secret private to the owner', () => {
		const dir = dataDir();
		new Access('secret passcode', dir);
		expect(statSync(join(dir, 'secret.key')).mode & 0o777).toBe(0o600);
	});

	it('limits failed attempts, then recovers after the window', () => {
		const access = new Access('secret passcode', dataDir());
		const now = Date.now();
		for (let i = 0; i < 10; i++) expect(access.attempt('wrong', now)).toBe('wrong');
		expect(access.attempt('secret passcode', now)).toBe('limited');
		expect(access.attempt('secret passcode', now + 11 * 60_000)).toBe('ok');
	});
});

describe('sessionCookieOptions', () => {
	const post = (origin?: string) =>
		new Request('https://readhouse.local/api/unlock', {
			method: 'POST',
			headers: origin ? { origin } : {}
		});
	// adapter-node reports https unless told otherwise, so the browser's Origin decides.
	const url = new URL('https://readhouse.local/api/unlock');

	it('is not Secure when the page is on plain http', () => {
		expect(sessionCookieOptions(post('http://192.168.1.20:3000'), url).secure).toBe(false);
	});

	it('is Secure over https, and without an Origin when the server says https', () => {
		expect(sessionCookieOptions(post('https://box.tail1234.ts.net'), url).secure).toBe(true);
		expect(sessionCookieOptions(post(), url).secure).toBe(true);
	});
});
