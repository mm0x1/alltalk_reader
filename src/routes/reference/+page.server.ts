import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import { REFERENCE_PAGE } from '$app/env/private';
import type { PageServerLoad } from './$types';

/** The design system's reference sheet: in development, or when REFERENCE_PAGE=1 (visual tests). */
export const load: PageServerLoad = () => {
	if (!dev && !REFERENCE_PAGE) error(404, 'Not found');
};
