<script lang="ts">
	import { browser } from '$app/env';
	import { onMount, tick } from 'svelte';
	import { offlineAvailable, savedChapters } from '#lib/client/offline.js';
	import { resolve } from '$app/paths';
	import type { BookDetail, ChapterContent, SearchHit } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import ListRow from '#lib/ui/ListRow.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { toasts } from '#lib/ui/toasts.svelte.js';
	import FindInBook from './FindInBook.svelte';
	import PlayerBar from './PlayerBar.svelte';
	import PrepareBook from './PrepareBook.svelte';
	import { invalidateAll } from '$app/navigation';
	import { passageForBlock } from '#lib/text/passages.js';
	import { dropCapBlock } from './drop-cap.js';
	import { textRange } from './text-range.js';
	import type { Position } from './position.js';
	import { session } from './session.svelte.js';

	let {
		book,
		chapter: initialChapter,
		start
	}: {
		book: BookDetail;
		chapter: ChapterContent;
		start: Position;
	} = $props();

	// Created once per book (the page keys this component by book id).
	// svelte-ignore state_referenced_locally
	const player = browser ? session.open(book, start, initialChapter) : null;

	const chapter = $derived(player?.chapter ?? initialChapter);
	const position = $derived(player?.position ?? start);
	const showingCurrent = $derived(chapter.position === position.chapter);

	/**
	 * Where the passage being read lies, paragraph by paragraph: a passage can span several short
	 * paragraphs, or be part of a long one. Offsets keep a poem's line breaks on screen.
	 */
	const reading = $derived.by(() => {
		const ranges: Record<number, [number, number]> = {};
		const passage = showingCurrent ? chapter.passages[position.passage] : undefined;
		for (const piece of passage?.pieces ?? []) ranges[piece.block] = [piece.start, piece.end];
		return ranges;
	});

	/** The paragraph that opens the chapter with a drop cap (see drop-cap.ts). */
	const openingBlock = $derived(dropCapBlock(chapter.blocks));
	let contentsOpen = $state(false);
	let findOpen = $state(false);
	let follow = $state(true);
	let canSave = $state(false);
	let saved = $state<ReadonlySet<number>>(new Set());
	let saving = $state<{ index: number; done: number; total: number } | null>(null);
	let saveController: AbortController | null = null;
	/** The button or link last focused by a click, which doesn't get to keep Space. */
	let clicked: Element | null = null;

	onMount(() => {
		canSave = offlineAvailable();
		void savedChapters(book.id, chapter.passageChars).then((set) => (saved = set));
		return () => saveController?.abort();
	});

	async function saveChapter(index: number) {
		if (!player) return;
		saveController?.abort();
		const controller = new AbortController();
		saveController = controller;
		saving = { index, done: 0, total: 0 };
		const title = book.chapters[index]?.title ?? 'This chapter';
		try {
			await player.saveChapter(
				index,
				(done, total) => (saving = { index, done, total }),
				controller.signal
			);
			saved = new Set([...saved, index]);
			toasts.show(`${title} is saved for listening offline.`);
		} catch (error) {
			if (!controller.signal.aborted) {
				const reason = error instanceof Error ? ` ${error.message}` : '';
				toasts.show(`${title} wasn\u2019t saved.${reason}`, {
					problem: true,
					action: { label: 'Try again', run: () => void saveChapter(index) }
				});
			}
		} finally {
			if (saveController === controller) {
				saving = null;
				saveController = null;
			}
		}
	}

	/** The passage being read, on the page. */
	const speaking = () => document.querySelector('article.page .speaking');

	// Keep the passage being read in view, unless the reader has scrolled away. Smoothly, unless
	// the device asks for reduced motion (an explicit `smooth` would override the CSS rule).
	$effect(() => {
		void reading;
		if (!follow || !player?.active || !showingCurrent) return;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		speaking()?.scrollIntoView({ block: 'center', behavior: still ? 'instant' : 'smooth' });
	});

	// In the desktop sidebar, keep the chapter being read in the middle of the list, once the
	// book face has loaded (rows change height with it). Only the list scrolls, never the page.
	$effect(() => {
		void position.chapter;
		const list = document.querySelector<HTMLElement>('.side-contents');
		if (!list?.clientHeight) return;
		void document.fonts.ready.then(() => {
			const row = list.querySelector('[aria-current="true"]');
			if (!row) return;
			const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
			list.scrollTop += offset - (list.clientHeight - row.clientHeight) / 2;
		});
	});

	function stopFollowing() {
		if (player?.active) follow = false;
	}

	function resumeFollowing() {
		follow = true;
		speaking()?.scrollIntoView({ block: 'center' });
	}

	/** Tapping a paragraph reads from there (unless the tap was selecting text). */
	function readFrom(event: MouseEvent) {
		if (!player || window.getSelection()?.toString()) return;
		const target = (event.target as HTMLElement).closest<HTMLElement>('[data-block]');
		if (!target) return;
		const passage = passageForBlock(chapter.passages, Number(target.dataset.block));
		if (passage === null) return;
		follow = true;
		void player.seek({ chapter: chapter.position, passage }, true);
	}

	/**
	 * Space plays and pauses, arrows move by passage, `/` finds; never while typing or in a dialog. A button
	 * or link focused from the keyboard keeps Space for itself; one focused by a click doesn't,
	 * so Space after clicking Next still means play.
	 */
	function shortcut(event: KeyboardEvent) {
		if (!player || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
		const target = event.target as HTMLElement;
		if (target.closest('input, textarea, select, [contenteditable], dialog')) return;
		// `/` finds in the book (Shift is how some keyboards type it).
		if (event.key === '/') {
			event.preventDefault();
			findOpen = true;
			return;
		}
		if (event.shiftKey) return;
		if (event.key === ' ') {
			const control = target.closest<HTMLElement>('button, a, summary');
			if (control && control !== clicked) return;
			event.preventDefault();
			if (event.repeat) return;
			// Blurred so the key's release doesn't also click the button.
			control?.blur();
			player.toggle();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			void player.next();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			void player.previous();
		}
	}

	/**
	 * A search result: the place moves to its paragraph, paused (Play reads from there), and the
	 * words found are marked until reading starts. The mark is a CSS highlight, so the page's text
	 * isn't touched; browsers without highlights just show the place.
	 */
	async function goTo(hit: SearchHit) {
		if (!player) return;
		findOpen = false;
		follow = true;
		try {
			await player.seekBlock(hit.chapter, hit.block);
		} catch {
			toasts.show('That chapter couldn\u2019t be opened. Check the connection and try again.', {
				problem: true
			});
			return;
		}
		await tick();
		const block = document.getElementById(`block-${hit.block}`);
		if (!block) return;
		await centre(block);
		const found = hit.parts.find((part) => part.match)?.text;
		const range = found ? textRange(block, found) : null;
		if (range && 'highlights' in CSS) CSS.highlights.set('found', new Highlight(range));
		toasts.show('Your place is now here. Play reads from it.');
	}

	/** For one frame before a jump, every paragraph laid out (see `centre`). */
	let layingOut = $state(false);

	/**
	 * Jumps to a paragraph anywhere in a long chapter. Paragraphs off screen are laid out at an
	 * estimated height (`content-visibility`) that changes as they render, so a plain jump lands
	 * short and keeps drifting. The whole chapter is laid out once; each paragraph then keeps its
	 * real height (`contain-intrinsic-block-size: auto`), and the jump lands where it should.
	 */
	async function centre(block: HTMLElement) {
		const frame = () => new Promise((done) => requestAnimationFrame(done));
		layingOut = true;
		await tick();
		await frame();
		await frame();
		layingOut = false;
		await tick();
		block.scrollIntoView({ block: 'center' });
	}

	// The words found stay marked until reading starts or the chapter changes.
	$effect(() => {
		void chapter.position;
		if (player?.active && 'highlights' in CSS) CSS.highlights.delete('found');
		return () => {
			if ('highlights' in CSS) CSS.highlights.delete('found');
		};
	});

	function openChapter(index: number) {
		contentsOpen = false;
		follow = true;
		window.scrollTo({ top: 0 });
		void player?.openChapter(index);
	}
</script>

<svelte:window
	onwheel={stopFollowing}
	ontouchmove={stopFollowing}
	onkeydown={shortcut}
	onpointerdown={(event) => (clicked = (event.target as Element).closest('button, a, summary'))}
	onfocusin={(event) => {
		if (event.target !== clicked) clicked = null;
	}}
/>
<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'hidden') player?.saveNow();
	}}
/>

<div class="reader">
	<!-- Desktop (Folio): the book and its contents in a ruled sidebar, always open. -->
	<aside class="side" aria-label="Book">
		<p class="wordmark">Readhouse</p>
		<div class="now">
			<span class="kicker">Now reading</span>
			<span class="side-title">{book.title}</span>
			{#if book.author}<span class="side-author">{book.author}</span>{/if}
		</div>
		<Button variant="outline" icon="search" onclick={() => (findOpen = true)}>
			Find <kbd>/</kbd>
		</Button>
		<nav class="side-contents" aria-label="Contents">{@render contentsList()}</nav>
		<Button href={resolve('/')} icon="back">The shelf</Button>
	</aside>

	<main class="main">
		<header class="top">
			<Button class="phone-only" href={resolve('/')} icon="back" aria-label="Library" />
			<div class="titles">
				<p class="book-title">{book.title}</p>
				<h1 class="chapter-title">{chapter.title}</h1>
			</div>
			<Button
				class="phone-only"
				icon="search"
				aria-label="Find in the book"
				onclick={() => (findOpen = true)}
			/>
			<Button
				class="phone-only"
				icon="contents"
				aria-label="Contents"
				onclick={() => (contentsOpen = true)}
			/>
		</header>

		<!-- Keyboard and screen-reader users start reading with the player controls and Contents. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
		<article
			class={['page', player?.active && 'playing', layingOut && 'laying-out']}
			lang={book.language ?? undefined}
			onclick={readFrom}
		>
			<div class="band" aria-hidden="true"></div>
			{#each chapter.blocks as block, index (index)}
				{#if block.type === 'break'}
					<hr />
				{:else if block.type === 'heading'}
					<h2
						id={`block-${index}`}
						data-block={index}
						aria-current={reading[index] ? 'true' : undefined}
					>
						{@render marked(block.text, reading[index])}
					</h2>
				{:else}
					<p
						id={`block-${index}`}
						class={{ opening: index === openingBlock }}
						data-block={index}
						aria-current={reading[index] ? 'true' : undefined}
					>
						{@render marked(block.text, reading[index])}
					</p>
				{/if}
			{/each}

			<nav class="chapter-nav" aria-label="Chapters">
				{#if chapter.position > 0}
					<Button variant="outline" onclick={() => openChapter(chapter.position - 1)}>
						Previous chapter
					</Button>
				{/if}
				{#if chapter.position < book.chapterCount - 1}
					<Button variant="outline" onclick={() => openChapter(chapter.position + 1)}>
						Next chapter
					</Button>
				{/if}
			</nav>
		</article>
	</main>

	{#if !follow && player?.active}
		<div class="follow">
			<Button variant="outline" icon="follow" onclick={resumeFollowing}>Back to the voice</Button>
		</div>
	{/if}

	{#if player}
		<PlayerBar {player} />
	{/if}
</div>

<!-- A paragraph's text, with the part being read marked; kept on one line so no space creeps in. -->
{#snippet marked(text: string, range: [number, number] | undefined)}
	{#if range}{text.slice(0, range[0])}<span class="segment speaking"
			>{text.slice(range[0], range[1])}</span
		>{text.slice(range[1])}{:else}{text}{/if}
{/snippet}

{#snippet contentsList()}
	<PrepareBook bookId={book.id} onchange={() => invalidateAll()} />
	<ol class="contents">
		{#each book.chapters as entry, index (index)}
			<li>
				<ListRow
					title={entry.title}
					meta={saving?.index === index
						? `${saving.done} of ${saving.total || '\u2026'}`
						: `${entry.wordCount.toLocaleString()} words`}
					current={index === position.chapter}
					onclick={() => openChapter(index)}
				/>
				{#if canSave}
					{#if saving?.index === index}
						<Button
							icon="close"
							aria-label={`Stop saving ${entry.title}`}
							onclick={() => saveController?.abort()}
						/>
					{:else if saved.has(index)}
						<span class="saved" title="Saved for offline listening">
							<Button
								icon="saved"
								aria-label={`${entry.title} is saved; save again`}
								onclick={() => saveChapter(index)}
							/>
						</span>
					{:else}
						<Button
							icon="save"
							aria-label={`Save ${entry.title} for offline listening`}
							disabled={saving !== null}
							onclick={() => saveChapter(index)}
						/>
					{/if}
				{/if}
				{#if saving?.index === index}
					<div class="saving">
						<Progress value={saving.done} max={saving.total} label={`Saving ${entry.title}`} />
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/snippet}

<Sheet bind:open={contentsOpen} title="Contents">
	{#if contentsOpen}{@render contentsList()}{/if}
</Sheet>

<!-- Kept while closed, so the words and places are still there after going to one. -->
<Sheet bind:open={findOpen} title="Find in the book">
	<FindInBook bookId={book.id} chapters={book.chapters} onpick={goTo} />
</Sheet>

<style>
	.side {
		display: none;
	}

	@media (min-width: 64rem) {
		.reader {
			/* Read by the docked player bar and the follow button, which are fixed. */
			--reader-side: var(--sidebar-width);
			display: grid;
			grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
		}

		.side {
			position: sticky;
			top: 0;
			display: grid;
			grid-template-rows: auto auto auto minmax(0, 1fr) auto;
			gap: var(--space-4);
			height: 100dvh;
			padding: calc(var(--space-6) + var(--safe-top)) var(--space-4)
				calc(var(--space-5) + var(--safe-bottom)) var(--space-6);
			border-right: var(--border-thin) solid var(--color-rule);
		}

		.side > :global(.button) {
			justify-self: start;
		}

		.top :global(.phone-only) {
			visibility: hidden;
		}
	}

	.wordmark {
		font-size: var(--text-xl);
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-display);
	}

	.now {
		display: grid;
		gap: var(--space-1);
		padding-bottom: var(--space-4);
		border-bottom: var(--border-thin) solid var(--color-rule-soft);
	}

	.kicker {
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.side-title {
		font-size: var(--text-l);
		line-height: var(--leading-tight);
	}

	.side-author {
		color: var(--color-ink-muted);
		font-style: italic;
	}

	.side-contents {
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.top {
		position: sticky;
		top: 0;
		z-index: var(--layer-player);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: calc(var(--space-5) + var(--safe-top)) var(--space-5) var(--space-2);
		background: var(--color-paper);
	}

	.titles {
		flex: 1;
		min-width: 0;
		text-align: center;
	}

	.book-title,
	.chapter-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.book-title {
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.chapter-title {
		font-size: var(--text-m);
		font-weight: var(--weight-regular);
		font-style: italic;
	}

	.page {
		max-width: var(--measure);
		margin: 0 auto;
		padding: var(--space-2) var(--space-6) calc(var(--player-height) + var(--space-8));
		font-family: var(--font-reading);
		font-size: var(--text-reading);
		line-height: var(--leading-reading);
		hyphens: auto;
		text-wrap: pretty;
	}

	/* Justified only where the measure is long enough; on a phone it opens rivers of space. */
	@media (min-width: 40rem) {
		.page {
			text-align: justify;
		}
	}

	/* The chapter's engraved band: a dithered plate with its numeral. */
	/*
	 * The chapter opening: a dithered band, densest at the top and fading down into the page.
	 * (No numeral: a book's sections rarely match its chapter numbers.)
	 */
	.band {
		height: var(--band-height);
		margin: 0 calc(var(--space-2) * -1) var(--space-5);
		background-image: var(--dither-band);
		background-size: auto 100%;
		image-rendering: pixelated;
		transform: scaleY(-1);
	}

	.page p,
	.page h2 {
		margin: 0 0 var(--space-3);
		cursor: pointer;
		content-visibility: auto;
		contain-intrinsic-block-size: auto 6lh;
	}

	.page p {
		white-space: pre-line;
	}

	.laying-out p,
	.laying-out h2 {
		content-visibility: visible;
	}

	.page h2 {
		margin-top: var(--space-5);
		font-size: var(--text-xl);
		font-weight: var(--weight-medium);
		font-style: italic;
		line-height: var(--leading-tight);
		text-align: center;
		hyphens: manual;
	}

	.page .opening::first-letter {
		float: left;
		padding: var(--space-1) var(--space-2) 0 0;
		font-size: var(--text-initial);
		font-weight: var(--weight-medium);
		line-height: var(--leading-initial);
		/* Floats out of the sentence being spoken, so it keeps its own ink. */
		background: none;
		color: var(--color-ink);
	}

	/* Being read: a heading or verse is tinted; prose marks the sentence being spoken in reverse. */
	.page [aria-current='true']:not(:has(.segment)) {
		background: var(--color-highlight-soft);
	}

	.segment {
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
		transition:
			background-color var(--duration-medium) var(--ease-out),
			color var(--duration-medium) var(--ease-out);
	}

	.speaking {
		background: var(--color-highlight-soft);
	}

	/* Reverse ink only while the voice is reading; paused, a tint keeps the place. */
	.playing .speaking {
		background: var(--color-highlight);
		color: var(--color-highlight-ink);
	}

	/* The words a search found, on the page (see goTo). */
	:global(::highlight(found)) {
		background: var(--color-highlight);
		color: var(--color-highlight-ink);
	}

	.page hr {
		margin: var(--space-5) 0;
		border: none;
		text-align: center;
	}

	.page hr::after {
		content: '\2766';
		color: var(--color-ink-faint);
	}

	.chapter-nav {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-7);
		font-family: var(--font-ui);
	}

	.follow {
		position: fixed;
		inset: auto 0 calc(var(--player-height) + var(--space-5) + var(--safe-bottom))
			var(--reader-side, 0);
		z-index: var(--layer-player);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.follow :global(.button) {
		pointer-events: auto;
		background: var(--color-paper-raised);
		box-shadow: var(--shadow-raised);
	}

	.contents li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		column-gap: var(--space-1);
	}

	/* Under the row's title and figure, not under its button. */
	.saving {
		grid-column: 1;
		padding: var(--space-2) var(--space-2) var(--space-2);
	}

	.saved {
		color: var(--color-accent);
	}
</style>
