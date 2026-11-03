import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Non-ASCII characters in TypeScript are written as \uXXXX escapes, so typographic quotes
		// and dashes can't be mistaken for (or silently replaced by) their ASCII look-alikes.
		files: ['**/*.ts'],
		rules: {
			'no-restricted-syntax': [
				'error',
				...['Literal[raw=/[^\\x00-\\x7f]/]', 'TemplateElement[value.raw=/[^\\x00-\\x7f]/]'].map(
					(selector) => ({ selector, message: 'Write non-ASCII characters as \\uXXXX escapes.' })
				)
			]
		}
	},
	{
		// The design system, enforced: form controls come from src/lib/ui/ (Button, Select,
		// TextField, Checkbox, Radio, Slider, FilePicker, ListRow), never raw elements.
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/ui/**'],
		rules: {
			'svelte/no-restricted-html-elements': [
				'error',
				{
					elements: ['button', 'input', 'select', 'textarea'],
					message: 'Use the design-system component from src/lib/ui/ instead.'
				}
			]
		}
	}
);
