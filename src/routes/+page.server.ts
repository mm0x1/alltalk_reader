import { app } from '#lib/server/app.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ books: app().library.list() });
