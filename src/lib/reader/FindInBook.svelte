<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import { api } from '#lib/client/api.js';
	import type { ChapterSummary, SearchHit, SearchResults } from '#lib/library.js';
	import SnippetRow from '#lib/ui/SnippetRow.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	/**
	 * Contents with a way to find a passage: a field at the top, and while it has words, the
	 * places they appear instead of the chapters (`children`). Going to a place clears it, so
	 * Contents shows the chapters again next time.
	 */
	let {
		id,
		bookId,
		chapters,
		onpick,
		children
	}: {
		id: string;
		bookId: string;
		chapters: ChapterSummary[];
		onpick: (hit: SearchHit) => void;
		children: Snippet;
	} = $props();

	/** Waits this long after the last key, so typing a word asks once, not per letter. */
	const PAUSE_MS = 200;

	let query = $state('');
	/** The last answer, with the words it answers (the field may have moved on). */
	let results = $state<(SearchResults & { words: string }) | null>(null);
	let searching = $state(false);
	let failed = $state(false);
	const finding = $derived(query.trim() !== '');

	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | null = null;

	/** Asks again a moment after typing stops; an answer to older words is dropped. */
	function find(value: string) {
		clearTimeout(timer);
		controller?.abort();
		const words = value.trim();
		searching = false;
		if (!words) {
			results = null;
			failed = false;
			return;
		}
		const current = (controller = new AbortController());
		timer = setTimeout(async () => {
			searching = true;
			try {
				results = { ...(await api.search(bookId, words, current.signal)), words };
				failed = false;
			} catch {
				if (!current.signal.aborted) failed = true;
			} finally {
				if (!current.signal.aborted) searching = false;
			}
		}, PAUSE_MS);
	}

	function pick(hit: SearchHit) {
		query = '';
		find('');
		onpick(hit);
	}

	onDestroy(() => {
		clearTimeout(timer);
		controller?.abort();
	});

	const places = (n: number) => (n === 1 ? '1 place' : `${n.toLocaleString()} places`);
</script>

<div class="find">
	<TextField
		{id}
		label="Find in the book"
		hideLabel
		type="search"
		placeholder="Find in the book"
		autocomplete="off"
		enterkeyhint="search"
		maxlength={200}
		bind:value={query}
		oninput={(event) => find(event.currentTarget.value)}
	/>

	<!-- Always there, so screen readers hear the count as it changes; empty until there are words. -->
	<p class="summary" role="status">
		{#if finding}
			{#if failed}
				Search needs the computer Readhouse runs on. Check the connection and try again.
			{:else if searching && !results}
				<Spinner /> Looking
			{:else if results}
				{#if results.total === 0}
					Nothing found for &ldquo;{results.words}&rdquo;.
				{:else}
					{places(results.total)} in {results.chapters === 1
						? '1 chapter'
						: `${results.chapters} chapters`}
				{/if}
			{/if}
		{/if}
	</p>

	<div class="below">
		{#if !finding}
			{@render children()}
		{:else if results?.hits.length}
			<ol>
				{#each results.hits as hit (`${hit.chapter}:${hit.block}`)}
					<li>
						<SnippetRow
							label={chapters[hit.chapter]?.title ?? `Chapter ${hit.chapter + 1}`}
							parts={hit.parts}
							onclick={() => pick(hit)}
						/>
					</li>
				{/each}
			</ol>
			{#if results.total > results.hits.length}
				<p class="more">
					The first {results.hits.length} places are shown; add a word to narrow it.
				</p>
			{/if}
		{/if}
	</div>
</div>

<style>
	.summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-ink-muted);
		font-size: var(--text-s);
	}

	.summary:not(:empty) {
		padding-top: var(--space-3);
	}

	.below {
		padding-top: var(--space-4);
	}

	.more {
		padding-top: var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--text-s);
		font-style: italic;
	}
</style>
