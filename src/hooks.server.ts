import { json, redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { app } from '#lib/server/app.js';
import { SESSION_COOKIE } from '#lib/server/access.js';
import { compress } from '#lib/server/compress.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Reachable without the passcode: the unlock page and its endpoint, and static build files. */
const PUBLIC_PATHS = new Set([
	'/unlock',
	'/api/unlock',
	'/manifest.webmanifest',
	'/service-worker.js'
]);
const PUBLIC_PREFIXES = ['/_app/immutable/', '/_app/version.json', '/icons/'];

const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'no-referrer',
	'cross-origin-opener-policy': 'same-origin',
	'cross-origin-resource-policy': 'same-origin',
	'permissions-policy':
		'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
};

/**
 * Rejects cross-site state changes. Compares hosts rather than full origins so it keeps working
 * behind an HTTPS proxy such as `tailscale serve`; an attacker's page can't make a victim's
 * browser send a matching Origin and Host pair.
 */
function isCrossSite(request: Request): boolean {
	const site = request.headers.get('sec-fetch-site');
	if (site && site !== 'same-origin' && site !== 'none') return true;
	const origin = request.headers.get('origin');
	if (!origin) return false;
	try {
		return new URL(origin).host !== request.headers.get('host');
	} catch {
		return true;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const { request, url } = event;
	const isApi = url.pathname.startsWith('/api/');

	if (!SAFE_METHODS.has(request.method) && isCrossSite(request)) {
		return json({ message: 'Cross-site requests are not allowed.' }, { status: 403 });
	}

	const { access } = app();
	const isPublic =
		PUBLIC_PATHS.has(url.pathname) ||
		PUBLIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
	if (access.required && !isPublic && !access.verify(event.cookies.get(SESSION_COOKIE))) {
		if (isApi) return json({ message: 'Locked. Enter the passcode first.' }, { status: 401 });
		const next = url.pathname + url.search;
		redirect(303, `/unlock?next=${encodeURIComponent(next)}`);
	}

	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	if (url.protocol === 'https:') {
		response.headers.set('strict-transport-security', 'max-age=31536000');
	}
	if (isApi && !response.headers.has('cache-control')) {
		response.headers.set('cache-control', 'no-store');
	}
	return compress(request, response);
};

/** A client that hangs up mid-request (a cancelled prefetch, a closed tab) is normal here. */
function isClientAbort(error: unknown): boolean {
	const code = (error as { code?: unknown } | null)?.code;
	return (
		(error instanceof Error && error.message === 'aborted') ||
		code === 'ECONNRESET' ||
		code === 'ABORT_ERR'
	);
}

/**
 * Errors thrown with `error()` keep their status and message. Anything unexpected is logged on
 * the server, and the browser only gets SvelteKit's generic message.
 */
export const handleError: HandleServerError = ({ kind, error }) => {
	if (kind !== 'unknown' || isClientAbort(error)) return;
	console.error(error);
};
