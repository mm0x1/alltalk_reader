/**
 * Optional passcode protection for opening Readhouse from other devices.
 *
 * A correct passcode earns a signed, HttpOnly, SameSite=Strict cookie. The signature covers
 * the passcode itself, so changing the passcode signs everyone out. Failed attempts are rate
 * limited globally (behind `tailscale serve` every client shares one address, so per-IP
 * limits would mean nothing), and comparisons are constant-time.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SESSION_COOKIE = 'readhouse_session';
const SESSION_DAYS = 90;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 10;

function digest(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

/**
 * Options for the session cookie, for setting and clearing it alike. `Secure` follows the
 * scheme the browser sees, from the Origin header it sends with a POST: without `ORIGIN` or
 * `PROTOCOL_HEADER`, adapter-node takes every request for https, and browsers drop a Secure
 * cookie over plain http (Safari always, Chrome except on localhost), so the device would
 * never stay unlocked on the LAN.
 */
export function sessionCookieOptions(request: Request, url: URL) {
	const origin = request.headers.get('origin');
	const secure = origin ? origin.startsWith('https:') : url.protocol === 'https:';
	return { path: '/', httpOnly: true, sameSite: 'strict', secure } as const;
}

export function safeEqual(a: string, b: string): boolean {
	return timingSafeEqual(digest(a), digest(b));
}

/** A random secret kept in the data directory, created on first use (owner-only). */
function loadSecret(dataDir: string): Buffer {
	const path = join(dataDir, 'secret.key');
	try {
		const secret = readFileSync(path);
		if (secret.length >= 32) return secret;
	} catch {
		// Not created yet.
	}
	const secret = randomBytes(32);
	writeFileSync(path, secret, { mode: 0o600 });
	return secret;
}

export class Access {
	readonly #secret: Buffer;
	#failures: number[] = [];

	constructor(
		private readonly passcode: string | undefined,
		dataDir: string
	) {
		this.#secret = passcode ? loadSecret(dataDir) : Buffer.alloc(0);
	}

	get required(): boolean {
		return this.passcode !== undefined;
	}

	#sign(issuedAt: number): string {
		return createHmac('sha256', this.#secret)
			.update(`v1:${issuedAt}:`)
			.update(digest(this.passcode ?? ''))
			.digest('base64url');
	}

	/** A cookie value for a newly unlocked device. */
	issue(now = Date.now()): string {
		return `${now}.${this.#sign(now)}`;
	}

	verify(cookie: string | undefined, now = Date.now()): boolean {
		if (!this.required) return true;
		if (!cookie) return false;
		const [issued, signature] = cookie.split('.');
		const issuedAt = Number(issued);
		if (!Number.isSafeInteger(issuedAt) || !signature) return false;
		if (issuedAt > now + 60_000 || now - issuedAt > SESSION_DAYS * 86_400_000) return false;
		return safeEqual(signature, this.#sign(issuedAt));
	}

	/** Checks a passcode attempt. Returns 'limited' while too many recent attempts failed. */
	attempt(passcode: string, now = Date.now()): 'ok' | 'wrong' | 'limited' {
		this.#failures = this.#failures.filter((at) => now - at < WINDOW_MS);
		if (this.#failures.length >= MAX_FAILURES_PER_WINDOW) return 'limited';
		if (this.passcode !== undefined && safeEqual(passcode, this.passcode)) return 'ok';
		this.#failures.push(now);
		return 'wrong';
	}

	static readonly maxAgeSeconds = SESSION_DAYS * 86_400;
}
