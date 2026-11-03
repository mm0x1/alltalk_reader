<script lang="ts">
	import { onDestroy } from 'svelte';
	import { api } from '#lib/client/api.js';
	import type { ChapterSummary, SearchHit, SearchResults } from '#lib/library.js';
	import SnippetRow from '#lib/ui/SnippetRow.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	/** Finding a passage: the words, the places they appear, and a way to go to one. */
	let {
		bookId,
		chapters,
		onpick
	}: {
		bookId: string;
		chapters: ChapterSummary[];
		onpick: (hit: SearchHit) => void;
	} = $props();

	/** Waits this long after the last key, so typing a word asks once, not per letter. */
	const PAUSE_MS = 200;

	/** The last answer, with the words it answers (the field may have moved on). */
	let results = $state<(SearchResults & { words: string }) | null>(null);
	let searching = $state(false);
	let failed = $state(false);

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

	onDestroy(() => {
		clearTimeout(timer);
		controller?.abort();
	});

	const places = (n: number) => (n === 1 ? '1 place' : `${n.toLocaleString()} places`);
</script>

<div class="find">
	<!-- The sheet opens to type in, so focus goes to the field rather than Close. -->
	<TextField
		id="find"
		label="Words to find"
		hideLabel
		type="search"
		placeholder="Words to find"
		autocomplete="off"
		enterkeyhint="search"
		maxlength={200}
		autofocus
		oninput={(event) => find(event.currentTarget.value)}
	/>

	<p class="summary" role="status">
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
	</p>

	{#if results?.hits.length}
		<ol class="hits">
			{#each results.hits as hit (`${hit.chapter}:${hit.block}`)}
				<li>
					<SnippetRow
						label={chapters[hit.chapter]?.title ?? `Chapter ${hit.chapter + 1}`}
						parts={hit.parts}
						onclick={() => onpick(hit)}
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

<style>
	.find {
		display: grid;
		gap: var(--space-3);
	}

	.summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-ink-muted);
		font-size: var(--text-s);
	}

	.more {
		color: var(--color-ink-muted);
		font-size: var(--text-s);
		font-style: italic;
	}
</style>
