<script lang="ts">
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { offlineAvailable, savedChapters } from '#lib/client/offline.js';
	import { resolve } from '$app/paths';
	import type { BookDetail, ChapterContent } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import ListRow from '#lib/ui/ListRow.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { toasts } from '#lib/ui/toasts.svelte.js';
	import PlayerBar from './PlayerBar.svelte';
	import { toRoman } from '#lib/text/roman.js';
	import { passageForBlock } from '#lib/text/passages.js';
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

	/** The first paragraph of the chapter opens with a drop cap. */
	const openingBlock = $derived(chapter.blocks.findIndex((block) => block.type === 'text'));
	let contentsOpen = $state(false);
	let follow = $state(true);
	let canSave = $state(false);
	let saved = $state<ReadonlySet<number>>(new Set());
	let saving = $state<{ index: number; done: number; total: number } | null>(null);
	let saveController: AbortController | null = null;

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

	// Keep the passage being read in view, unless the reader has scrolled away.
	$effect(() => {
		void reading;
		if (!follow || !player?.active || !showingCurrent) return;
		speaking()?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

	// In the desktop sidebar, keep the chapter being read in view.
	$effect(() => {
		void position.chapter;
		document
			.querySelector('.side-contents [aria-current="true"]')
			?.scrollIntoView({ block: 'nearest' });
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

	/** Space plays and pauses, arrows move by passage; never while typing or in a dialog. */
	function shortcut(event: KeyboardEvent) {
		if (!player || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
		const target = event.target as HTMLElement;
		if (target.closest('input, textarea, select, button, a, [contenteditable], dialog')) return;
		if (event.key === ' ') {
			event.preventDefault();
			player.toggle();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			void player.next();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			void player.previous();
		}
	}

	function openChapter(index: number) {
		contentsOpen = false;
		follow = true;
		window.scrollTo({ top: 0 });
		void player?.openChapter(index);
	}
</script>

<svelte:window onwheel={stopFollowing} ontouchmove={stopFollowing} onkeydown={shortcut} />
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
		<nav class="side-contents" aria-label="Contents">{@render contentsList()}</nav>
		<Button href={resolve('/')} icon="back">The shelf</Button>
	</aside>

	<div class="main">
		<header class="top">
			<Button class="phone-only" href={resolve('/')} icon="back" aria-label="Library" />
			<div class="titles">
				<p class="book-title">{book.title}</p>
				<h1 class="chapter-title">{chapter.title}</h1>
			</div>
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
			class={['page', player?.active && 'playing']}
			lang={book.language ?? undefined}
			onclick={readFrom}
		>
			<div class="band" aria-hidden="true">
				<span>{toRoman(chapter.position + 1)}.</span>
			</div>
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
	</div>

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
			grid-template-rows: auto auto minmax(0, 1fr) auto;
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
	.band {
		display: grid;
		place-items: center;
		height: var(--band-height);
		margin: 0 calc(var(--space-2) * -1) var(--space-5);
		background-image: var(--dither-band);
		background-size: auto 100%;
		image-rendering: pixelated;
		font-size: var(--text-xl);
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-display);
	}

	/* A solid cartouche keeps the numeral legible over the screen. */
	.band span {
		padding: 0 var(--space-3);
		border: var(--border-double) double var(--color-paper);
		background: var(--color-ink);
		color: var(--color-paper);
		line-height: var(--leading-ui);
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
