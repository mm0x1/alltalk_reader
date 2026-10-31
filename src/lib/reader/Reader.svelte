<script lang="ts">
	import { browser } from '$app/env';
	import { resolve } from '$app/paths';
	import type { BookDetail, ChapterContent } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import PlayerBar from './PlayerBar.svelte';
	import type { Position } from './position.js';
	import { session } from './session.svelte.js';

	let {
		book,
		chapter: initialChapter,
		start,
		segmentMaxChars
	}: {
		book: BookDetail;
		chapter: ChapterContent;
		start: Position;
		segmentMaxChars: number;
	} = $props();

	// Created once per book (the page keys this component by book id).
	// svelte-ignore state_referenced_locally
	const player = browser ? session.open(book, segmentMaxChars, start, initialChapter) : null;

	const chapter = $derived(player?.chapter ?? initialChapter);
	const position = $derived(player?.position ?? start);
	const showingCurrent = $derived(chapter.position === position.chapter);
	let contentsOpen = $state(false);
	let follow = $state(true);

	// Keep the passage being read in view, unless the reader has scrolled away.
	$effect(() => {
		if (!follow || !player?.active || !showingCurrent) return;
		document
			.getElementById(`block-${position.block}`)
			?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

	function stopFollowing() {
		if (player?.active) follow = false;
	}

	function resumeFollowing() {
		follow = true;
		document.getElementById(`block-${position.block}`)?.scrollIntoView({ block: 'center' });
	}

	/** Tapping a paragraph reads from there (unless the tap was selecting text). */
	function readFrom(event: MouseEvent) {
		if (!player || window.getSelection()?.toString()) return;
		const target = (event.target as HTMLElement).closest<HTMLElement>('[data-block]');
		if (!target) return;
		follow = true;
		void player.seek(
			{ chapter: chapter.position, block: Number(target.dataset.block), segment: 0 },
			true
		);
	}

	function openChapter(index: number) {
		contentsOpen = false;
		follow = true;
		window.scrollTo({ top: 0 });
		void player?.openChapter(index);
	}
</script>

<svelte:window onwheel={stopFollowing} ontouchmove={stopFollowing} />
<svelte:document
	onvisibilitychange={() => {
		if (document.visibilityState === 'hidden') player?.saveNow();
	}}
/>

<header class="top">
	<Button href={resolve('/')} icon="back" aria-label="Library" />
	<div class="titles">
		<p class="book-title">{book.title}</p>
		<h1 class="chapter-title">{chapter.title}</h1>
	</div>
	<Button icon="contents" aria-label="Contents" onclick={() => (contentsOpen = true)} />
</header>

<!-- Keyboard and screen-reader users start reading with the player controls and Contents. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="page" lang={book.language ?? undefined} onclick={readFrom}>
	{#each chapter.blocks as block, index (index)}
		{#if block.type === 'break'}
			<hr />
		{:else if block.type === 'heading'}
			<h2
				id={`block-${index}`}
				data-block={index}
				aria-current={showingCurrent && index === position.block ? 'true' : undefined}
			>
				{block.text}
			</h2>
		{:else}
			<p
				id={`block-${index}`}
				data-block={index}
				aria-current={showingCurrent && index === position.block ? 'true' : undefined}
			>
				{block.text}
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

{#if !follow && player?.active}
	<div class="follow">
		<Button variant="outline" icon="follow" onclick={resumeFollowing}>Back to the voice</Button>
	</div>
{/if}

{#if player}
	<PlayerBar {player} />
{/if}

<Sheet bind:open={contentsOpen} title="Contents">
	<ol class="contents">
		{#each book.chapters as entry, index (index)}
			<li>
				<button
					type="button"
					aria-current={index === position.chapter ? 'true' : undefined}
					onclick={() => openChapter(index)}
				>
					<span class="entry-title">{entry.title}</span>
					<span class="entry-words">{entry.wordCount.toLocaleString()} words</span>
				</button>
			</li>
		{/each}
	</ol>
</Sheet>

<style>
	.top {
		position: sticky;
		top: 0;
		z-index: var(--layer-player);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: calc(var(--space-2) + var(--safe-top)) var(--space-2) var(--space-2);
		border-bottom: var(--border-thin) solid var(--color-rule);
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
		color: var(--color-ink-muted);
		font-size: var(--text-xs);
	}

	.chapter-title {
		font-size: var(--text-m);
		font-weight: var(--weight-medium);
	}

	.page {
		max-width: var(--measure);
		margin: 0 auto;
		padding: var(--space-6) var(--space-5) calc(var(--player-height) + var(--space-8));
		font-family: var(--font-reading);
		font-size: var(--text-reading);
		line-height: var(--leading-reading);
		hyphens: auto;
	}

	.page p,
	.page h2 {
		margin: 0 calc(var(--space-2) * -1) var(--space-3);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-s);
		white-space: pre-line;
		cursor: pointer;
		content-visibility: auto;
		contain-intrinsic-block-size: auto 6lh;
		transition: background-color var(--duration-medium) var(--ease-out);
	}

	.page h2 {
		margin-top: var(--space-5);
		font-size: var(--text-xl);
		font-weight: var(--weight-bold);
		line-height: var(--leading-tight);
		hyphens: manual;
	}

	.page [aria-current='true'] {
		background: var(--color-highlight);
	}

	.page hr {
		margin: var(--space-5) 0;
		border: none;
		text-align: center;
	}

	.page hr::after {
		content: '\2042';
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
		inset: auto 0 calc(var(--player-height) + var(--space-5) + var(--safe-bottom));
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

	.contents button {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius-s);
		background: none;
		text-align: start;
		cursor: pointer;
	}

	.contents button[aria-current='true'] {
		background: var(--color-highlight);
	}

	.entry-words {
		flex: none;
		color: var(--color-ink-muted);
		font-size: var(--text-xs);
	}
</style>
