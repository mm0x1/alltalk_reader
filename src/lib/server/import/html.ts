/**
 * Reduces (X)HTML to blocks of plain text. Markup is parsed, never rendered or kept, so
 * nothing in a book file can run script or load anything in the reader.
 */

import { Parser } from 'htmlparser2';
import type { Block } from '#lib/book.js';
import { collapseKeepingLines, normalizeText } from '#lib/text/normalize.js';
import { appendBlock, finishBlocks, isSceneBreak } from '#lib/text/paragraphs.js';

const BLOCK_TAGS = new Set([
	'address',
	'article',
	'aside',
	'blockquote',
	'body',
	'caption',
	'center',
	'dd',
	'div',
	'dl',
	'dt',
	'figcaption',
	'figure',
	'footer',
	'header',
	'li',
	'main',
	'ol',
	'p',
	'pre',
	'section',
	'table',
	'td',
	'th',
	'tr',
	'ul'
]);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
/** Content that is never text to read. */
const SKIP_TAGS = new Set([
	'head',
	'math',
	'nav',
	'noscript',
	'object',
	'rp',
	'rt',
	'script',
	'style',
	'svg',
	'template',
	'title'
]);

const DROP_CAP = /^\p{L}{1,2}$/u;

export interface HtmlBlocks {
	blocks: Block[];
	/** For each requested anchor id found: the index of the first block at or after it. */
	anchors: Map<string, number>;
}

function localName(name: string): string {
	const colon = name.lastIndexOf(':');
	return (colon === -1 ? name : name.slice(colon + 1)).toLowerCase();
}

/**
 * @param anchorIds element ids where the caller wants to split (chapter starts given as
 *   `file.xhtml#id` in a table of contents).
 */
export function htmlToBlocks(html: string, anchorIds: ReadonlySet<string> = new Set()): HtmlBlocks {
	const blocks: Block[] = [];
	const anchors = new Map<string, number>();
	let buffer = '';
	let skipDepth = 0;
	let headingDepth = 0;

	const flush = () => {
		const text = collapseKeepingLines(normalizeText(buffer));
		buffer = '';
		if (!text) return;
		if (isSceneBreak(text)) {
			appendBlock(blocks, { type: 'break' });
		} else if (headingDepth > 0) {
			appendBlock(blocks, { type: 'heading', text: text.replace(/\n/g, ' ') });
		} else {
			appendBlock(blocks, { type: 'text', text });
		}
	};

	const parser = new Parser(
		{
			onopentag(rawName, attributes) {
				const name = localName(rawName);
				const id = attributes.id;
				if (id && anchorIds.has(id) && !anchors.has(id)) {
					flush();
					anchors.set(id, blocks.length);
				}
				if (SKIP_TAGS.has(name)) {
					skipDepth++;
					return;
				}
				if (skipDepth > 0) return;
				if (name === 'br') buffer += '\n';
				else if (name === 'img' && DROP_CAP.test(attributes.alt ?? '')) {
					// A decorative first letter drawn as an image: its alt text is part of the word.
					buffer += attributes.alt;
				} else if (name === 'hr') {
					flush();
					appendBlock(blocks, { type: 'break' });
				} else if (BLOCK_TAGS.has(name)) flush();
				else if (HEADING_TAGS.has(name)) {
					flush();
					headingDepth++;
				}
			},
			ontext(text) {
				// Line breaks in the source are just whitespace; only <br> breaks a line.
				if (skipDepth === 0) buffer += text.replace(/[ \t\n\r\f]+/g, ' ');
			},
			onclosetag(rawName) {
				const name = localName(rawName);
				if (SKIP_TAGS.has(name)) {
					skipDepth = Math.max(0, skipDepth - 1);
					return;
				}
				if (skipDepth > 0) return;
				if (HEADING_TAGS.has(name)) {
					flush();
					headingDepth = Math.max(0, headingDepth - 1);
				} else if (BLOCK_TAGS.has(name)) flush();
			}
		},
		{ decodeEntities: true, recognizeSelfClosing: true }
	);
	parser.write(html);
	parser.end();
	flush();
	finishBlocks(blocks);
	for (const [id, index] of anchors) anchors.set(id, Math.min(index, blocks.length));
	return { blocks, anchors };
}
