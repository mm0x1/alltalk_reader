import { SESSION_COOKIE } from '#lib/server/access.js';
import type { RequestHandler } from './$types';

/** Signs this device out. */
export const POST: RequestHandler = ({ cookies }) => {
	cookies.delete(SESSION_COOKIE, { path: '/' });
	return new Response(null, { status: 204 });
};
