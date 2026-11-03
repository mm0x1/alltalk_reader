/** Where some words sit in an element's text, as a DOM range (for a CSS highlight). */

/**
 * The first occurrence of `words` in `element`'s text, or null. The text may be split over
 * several nodes (the sentence being read is its own span), so offsets are walked node by node.
 */
export function textRange(element: Element, words: string): Range | null {
	const start = element.textContent?.indexOf(words) ?? -1;
	if (start < 0 || !words) return null;
	const end = start + words.length;
	const range = document.createRange();
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let offset = 0;
	let started = false;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const length = node.textContent?.length ?? 0;
		if (!started && start < offset + length) {
			range.setStart(node, start - offset);
			started = true;
		}
		if (started && end <= offset + length) {
			range.setEnd(node, end - offset);
			return range;
		}
		offset += length;
	}
	return null;
}
