import { describe, expect, it } from 'vitest';
import { searchPhrase, snippetParts } from './search';

describe('searchPhrase', () => {
	it('makes one phrase whose last word may be unfinished', () => {
		expect(searchPhrase('Netherfield')).toBe('"Netherfield"*');
		expect(searchPhrase('  have you  hea ')).toBe('"have you hea"*');
	});

	it('matches a short last word whole, since "a*" would match most of the book', () => {
		expect(searchPhrase('a')).toBe('"a"');
		expect(searchPhrase('to be')).toBe('"to be"');
		expect(searchPhrase('\u65e5\u672c\u8a9e')).toBe('"\u65e5\u672c\u8a9e"*');
	});

	it('keeps only letters and digits, so FTS5 syntax never gets through', () => {
		expect(searchPhrase('Mr. Bennet\u2019s "wife" OR NEAR(x) title:*')).toBe(
			'"Mr Bennet s wife OR NEAR x title"*'
		);
		expect(searchPhrase('caf\u00e9 \u65e5\u672c 42')).toBe('"caf\u00e9 \u65e5\u672c 42"');
	});

	it('has nothing to look for without words', () => {
		expect(searchPhrase('')).toBeNull();
		expect(searchPhrase(' \u2014 "*" ')).toBeNull();
	});

	it('caps the number of words', () => {
		expect(searchPhrase('a '.repeat(100))?.split(' ')).toHaveLength(16);
	});
});

describe('snippetParts', () => {
	it('splits a snippet into plain text and matches', () => {
		expect(snippetParts('\u2026heard that \u0002Netherfield\u0003 Park is let')).toEqual([
			{ text: '\u2026heard that ', match: false },
			{ text: 'Netherfield', match: true },
			{ text: ' Park is let', match: false }
		]);
	});

	it('joins neighbouring matches and handles a match at either end', () => {
		expect(snippetParts('\u0002have\u0003 \u0002you\u0003')).toEqual([
			{ text: 'have', match: true },
			{ text: ' ', match: false },
			{ text: 'you', match: true }
		]);
		expect(snippetParts('\u0002a\u0003\u0002b\u0003')).toEqual([{ text: 'ab', match: true }]);
	});

	it('keeps markup in book text as text', () => {
		expect(snippetParts('<b>\u0002x\u0003</b>')).toEqual([
			{ text: '<b>', match: false },
			{ text: 'x', match: true },
			{ text: '</b>', match: false }
		]);
	});
});
