<script lang="ts">
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { api } from '#lib/client/api.js';
	import { forgetBook } from '#lib/client/offline.js';
	import { takeShared } from '#lib/client/share.js';
	import AddBook from '#lib/library/AddBook.svelte';
	import BookRow from '#lib/library/BookRow.svelte';
	import ContinuePlate from '#lib/library/ContinuePlate.svelte';
	import { session } from '#lib/reader/session.svelte.js';
	import Button from '#lib/ui/Button.svelte';
	import Confirm from '#lib/ui/Confirm.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** The book read most recently (the list comes most recent first). */
	const continueWith = $derived(data.books.find((book) => book.openedAt !== null) ?? null);

	let adding = $state(false);
	let dragging = $state(false);
	let addBook = $state<ReturnType<typeof AddBook>>();

	// Coming back from a book whose place is still being saved: show the shelf once it lands.
	onMount(() => {
		void session.player?.saved()?.then(() => invalidateAll());
	});

	// Something shared to Readhouse from another app arrives here (see the service worker).
	onMount(() => {
		if (!page.url.searchParams.has('shared')) return;
		replaceState(resolve('/'), {});
		void takeShared().then((shared) => {
			if (!shared) return;
			adding = true;
			if (shared.kind === 'file') addBook?.offerFile(shared.file);
			else if (shared.kind === 'text') addBook?.offerText(shared.text, shared.title);
			else addBook?.explainLink();
		});
	});

	/** The book waiting for "Remove this book?" to be answered. */
	let removing = $state<{ id: string; title: string } | null>(null);
	let confirmOpen = $state(false);

	function askRemove(id: string, title: string) {
		removing = { id, title };
		confirmOpen = true;
	}

	async function remove(id: string) {
		if (session.player?.book.id === id) session.close();
		await api.remove(id);
		await forgetBook(id);
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
	<Button href={resolve('/settings')} icon="settings">Settings</Button>
</header>

<main class="library">
	{#if continueWith}
		<ContinuePlate book={continueWith} />
	{/if}

	<div class="heading">
		<h2>The shelf</h2>
		<Button variant="outline" icon="add" onclick={() => (adding = true)}>Add a book</Button>
	</div>

	{#if data.books.length === 0}
		<EmptyState title="Nothing on the shelf yet.">
			Add an EPUB or a text file, or paste a chapter from AO3, and Readhouse will read it to you.
		</EmptyState>
	{:else}
		<ul class="books">
			{#each data.books as book (book.id)}
				<li><BookRow {book} onremove={() => askRemove(book.id, book.title)} /></li>
			{/each}
		</ul>
	{/if}
</main>

{#if dragging}
	<div class="drop" aria-hidden="true"><p>Drop to add to your library</p></div>
{/if}

<AddBook bind:this={addBook} bind:open={adding} />

<Confirm
	bind:open={confirmOpen}
	title="Remove this book?"
	confirmLabel="Remove the book"
	onconfirm={() => removing && remove(removing.id)}
>
	“{removing?.title}” and your place in it leave the library on every device.
</Confirm>

<style>
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: var(--content-max);
		margin: 0 auto;
		padding: calc(var(--space-5) + var(--safe-top)) var(--space-6) var(--space-3);
	}

	.wordmark {
		font-size: var(--text-xl);
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-display);
	}

	.library {
		display: grid;
		/* minmax(0, …): a long unwrapped detail line must ellipsize, not widen the column. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
		max-width: var(--content-max);
		margin: 0 auto;
		padding: var(--space-2) var(--space-6) calc(var(--player-height) + var(--space-7));
	}

	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: var(--weight-medium);
		font-style: italic;
	}

	.books {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		border-bottom: var(--border-thin) solid var(--color-rule);
	}

	/* Tablets: two columns of rows. Desktop goes back to one, as an index. */
	@media (min-width: 48rem) and (max-width: 63.99rem) {
		.books {
			grid-template-columns: repeat(auto-fill, minmax(var(--shelf-column-min), 1fr));
			column-gap: var(--space-6);
		}
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
		font-style: italic;
		pointer-events: none;
	}

	/* Desktop: one centred column, set like a printed index (layout C). */
	@media (min-width: 64rem) {
		.top {
			display: grid;
			grid-template-columns: 1fr auto 1fr;
			max-width: var(--index-width);
			padding-top: var(--space-7);
		}

		.wordmark {
			grid-column: 2;
			font-size: var(--text-2xl);
		}

		.top > :global(:last-child) {
			justify-self: end;
		}

		.library {
			max-width: var(--index-width);
		}
	}
</style>
