import { app } from '#lib/server/app.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { settings, access } = app();
	return { voice: settings.voice(), locked: access.required };
};
