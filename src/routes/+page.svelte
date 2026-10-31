<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/client/api.js';
	import AddBook from '#lib/library/AddBook.svelte';
	import BookRow from '#lib/library/BookRow.svelte';
	import { session } from '#lib/reader/session.svelte.js';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let adding = $state(false);
	let dragging = $state(false);
	let addBook = $state<ReturnType<typeof AddBook>>();

	async function remove(id: string, title: string) {
		if (!confirm(`Remove “${title}” from your library?`)) return;
		if (session.player?.book.id === id) session.close();
		await api.remove(id);
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Readhouse</title>
</svelte:head>

<svelte:window
	ondragover={(event) => {
		if (!event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		dragging = true;
	}}
	ondragleave={(event) => {
		if (!event.relatedTarget) dragging = false;
	}}
	ondrop={(event) => {
		event.preventDefault();
		dragging = false;
		const file = event.dataTransfer?.files[0];
		if (file) {
			adding = true;
			addBook?.addFile(file);
		}
	}}
/>

<header class="top">
	<h1 class="wordmark">Readhouse</h1>
	<Button href={resolve('/settings')} icon="settings" aria-label="Settings" />
</header>

<main class="library">
	<div class="heading">
		<h2>Library</h2>
		<Button variant="primary" icon="add" onclick={() => (adding = true)}>Add a book</Button>
	</div>

	{#if data.books.length === 0}
		<div class="empty">
			<p class="empty-title">Nothing on the shelves yet.</p>
			<p>
				Add an EPUB or a text file, or paste a chapter from AO3, and Readhouse will read it to you.
			</p>
		</div>
	{:else}
		<ul class="books">
			{#each data.books as book (book.id)}
				<li><BookRow {book} onremove={() => remove(book.id, book.title)} /></li>
			{/each}
		</ul>
	{/if}
</main>

{#if dragging}
	<div class="drop" aria-hidden="true"><p>Drop to add to your library</p></div>
{/if}

<AddBook bind:this={addBook} bind:open={adding} />

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: calc(var(--space-3) + var(--safe-top)) var(--space-4) var(--space-3);
	}

	.wordmark {
		font-family: var(--font-reading);
		font-size: var(--text-xl);
		font-weight: var(--weight-bold);
		letter-spacing: 0.01em;
	}

	.library {
		max-width: var(--content-max);
		margin: 0 auto;
		padding: 0 var(--space-4) calc(var(--player-height) + var(--space-7));
	}

	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin: var(--space-4) 0;
	}

	h2 {
		font-size: var(--text-2xl);
		font-family: var(--font-reading);
	}

	.books {
		display: grid;
		gap: var(--space-2);
	}

	@media (min-width: 48rem) {
		.books {
			grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
			gap: var(--space-3);
		}
	}

	.empty {
		max-width: var(--measure);
		margin: var(--space-7) auto;
		color: var(--color-ink-muted);
		text-align: center;
	}

	.empty-title {
		margin-bottom: var(--space-2);
		color: var(--color-ink);
		font-family: var(--font-reading);
		font-size: var(--text-l);
	}

	.drop {
		position: fixed;
		inset: 0;
		z-index: var(--layer-overlay);
		display: grid;
		place-items: center;
		background: var(--color-scrim);
		color: var(--color-paper);
		font-size: var(--text-xl);
		pointer-events: none;
	}
</style>
