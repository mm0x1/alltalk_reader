<script lang="ts">
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { offlineAvailable, savedChapters } from '#lib/client/offline.js';
	import { resolve } from '$app/paths';
	import type { BookDetail, ChapterContent } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import ListRow from '#lib/ui/ListRow.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import PlayerBar from './PlayerBar.svelte';
	import { toRoman } from '#lib/text/roman.js';
	import { splitIntoSegments } from '#lib/text/segments.js';
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

	/**
	 * The passage being read, split the way the server splits it, so the sentence being spoken
	 * can be marked. Not for verse: splitting joins lines, which would lose a poem's line breaks.
	 */
	const currentSegments = $derived.by(() => {
		if (!showingCurrent) return null;
		const block = chapter.blocks[position.block];
		if (!block || block.type !== 'text' || block.text.includes('\n')) return null;
		return splitIntoSegments(block.text, segmentMaxChars);
	});

	/** The first paragraph of the chapter opens with a drop cap. */
	const openingBlock = $derived(chapter.blocks.findIndex((block) => block.type === 'text'));
	let contentsOpen = $state(false);
	let follow = $state(true);
	let canSave = $state(false);
	let saved = $state<ReadonlySet<number>>(new Set());
	let saving = $state<{ index: number; done: number; total: number } | null>(null);
	let saveProblem = $state<string | null>(null);
	let saveController: AbortController | null = null;

	onMount(() => {
		canSave = offlineAvailable();
		void savedChapters(book.id).then((set) => (saved = set));
		return () => saveController?.abort();
	});

	async function saveChapter(index: number) {
		if (!player) return;
		saveController?.abort();
		const controller = new AbortController();
		saveController = controller;
		saveProblem = null;
		saving = { index, done: 0, total: 0 };
		try {
			await player.saveChapter(
				index,
				(done, total) => (saving = { index, done, total }),
				controller.signal
			);
			saved = new Set([...saved, index]);
		} catch (error) {
			if (!controller.signal.aborted) {
				saveProblem = error instanceof Error ? error.message : 'Could not save this chapter.';
			}
		} finally {
			if (saveController === controller) {
				saving = null;
				saveController = null;
			}
		}
	}

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
				aria-current={showingCurrent && index === position.block ? 'true' : undefined}
			>
				{block.text}
			</h2>
		{:else}
			{@const current = showingCurrent && index === position.block}
			<p
				id={`block-${index}`}
				class={{ opening: index === openingBlock }}
				data-block={index}
				aria-current={current ? 'true' : undefined}
			>
				{#if current && currentSegments}
					{#each currentSegments as segment, i (i)}<span
							class={['segment', i === position.segment && 'speaking']}
							>{segment}{i < currentSegments.length - 1 ? ' ' : ''}</span
						>{/each}
				{:else}
					{block.text}
				{/if}
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
	{#if saveProblem}<p class="save-problem" role="alert">{saveProblem}</p>{/if}
	<ol class="contents">
		{#each book.chapters as entry, index (index)}
			<li>
				<ListRow
					title={entry.title}
					meta={saving?.index === index
						? `Saving ${saving.done}/${saving.total || '\u2026'}`
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

	.contents li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.saved {
		color: var(--color-accent);
	}

	.save-problem {
		margin-bottom: var(--space-3);
		color: var(--color-danger);
	}
</style>
