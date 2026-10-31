import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { app } from '#lib/server/app.js';
import { Access, SESSION_COOKIE, sessionCookieOptions } from '#lib/server/access.js';
import { readJson } from '#lib/server/http.js';
import type { RequestHandler } from './$types';

const UnlockSchema = v.strictObject({ passcode: v.pipe(v.string(), v.maxLength(200)) });
const WRONG_PASSCODE_DELAY_MS = 600;

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const { passcode } = await readJson(request, UnlockSchema, 1024);
	const { access } = app();
	if (!access.required) return new Response(null, { status: 204 });

	const result = access.attempt(passcode);
	if (result === 'limited') error(429, 'Too many attempts. Wait a few minutes and try again.');
	if (result === 'wrong') {
		await new Promise((resolve) => setTimeout(resolve, WRONG_PASSCODE_DELAY_MS));
		error(401, 'That passcode is not right.');
	}
	cookies.set(SESSION_COOKIE, access.issue(), {
		...sessionCookieOptions(request, url),
		maxAge: Access.maxAgeSeconds
	});
	return new Response(null, { status: 204 });
};
