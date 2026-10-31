<script lang="ts">
	import { browser } from '$app/env';
	import { onMount } from 'svelte';
	import { offlineAvailable, savedChapters } from '#lib/client/offline.js';
	import { resolve } from '$app/paths';
	import type { BookDetail, ChapterContent } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import PlayerBar from './PlayerBar.svelte';
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
	 * can be marked. Only for single-line paragraphs: splitting joins lines, which would lose a
	 * poem's line breaks.
	 */
	const currentSegments = $derived.by(() => {
		if (!showingCurrent) return null;
		const block = chapter.blocks[position.block];
		if (!block || block.type !== 'text' || block.text.includes('\n')) return null;
		const segments = splitIntoSegments(block.text, segmentMaxChars);
		return segments.length > 1 ? segments : null;
	});
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
			{@const current = showingCurrent && index === position.block}
			<p id={`block-${index}`} data-block={index} aria-current={current ? 'true' : undefined}>
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
				<button
					type="button"
					class="entry"
					aria-current={index === position.chapter ? 'true' : undefined}
					onclick={() => openChapter(index)}
				>
					<span class="entry-title">{entry.title}</span>
					<span class="entry-words">
						{#if saving?.index === index}
							Saving {saving.done}/{saving.total || '…'}
						{:else}
							{entry.wordCount.toLocaleString()} words
						{/if}
					</span>
				</button>
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

	/* In a long paragraph, the sentence being spoken stands out from the rest of it. */
	.page [aria-current='true']:has(.speaking) {
		background: none;
	}

	.segment {
		border-radius: var(--radius-s);
		transition: background-color var(--duration-medium) var(--ease-out);
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	.speaking {
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

	.contents .entry {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		flex: 1;
		min-width: 0;
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius-s);
		background: none;
		text-align: start;
		cursor: pointer;
	}

	.contents .entry[aria-current='true'] {
		background: var(--color-highlight);
	}

	.entry-words {
		flex: none;
		color: var(--color-ink-muted);
		font-size: var(--text-xs);
	}
</style>
