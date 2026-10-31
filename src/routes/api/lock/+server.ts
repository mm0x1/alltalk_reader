import { SESSION_COOKIE, sessionCookieOptions } from '#lib/server/access.js';
import type { RequestHandler } from './$types';

/** Signs this device out. */
export const POST: RequestHandler = ({ cookies, request, url }) => {
	cookies.delete(SESSION_COOKIE, sessionCookieOptions(request, url));
	return new Response(null, { status: 204 });
};
