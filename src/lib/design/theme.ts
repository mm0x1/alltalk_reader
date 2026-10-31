/** The per-device colour theme, kept in localStorage and applied as `data-theme` on <html>. */

export const THEMES = ['system', 'light', 'sepia', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = 'readhouse:theme';

export function readTheme(): Theme {
	try {
		const stored = localStorage.getItem(THEME_KEY);
		return THEMES.includes(stored as Theme) ? (stored as Theme) : 'system';
	} catch {
		return 'system';
	}
}

export function applyTheme(theme: Theme): void {
	if (theme === 'system') delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = theme;
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {
		// Not remembered in private mode; still applied for this visit.
	}
}
