<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Button from '#lib/ui/Button.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';

	/** Plain words for the reader; error details stay in the server log. */
	const missing = $derived(page.status === 404);
	const book = $derived(page.url.pathname.startsWith('/book/'));
	const title = $derived(
		!missing
			? 'Something went wrong.'
			: book
				? 'This book isn\u2019t here.'
				: 'This page isn\u2019t here.'
	);
</script>

<svelte:head>
	<title>{missing ? 'Not found' : 'Something went wrong'} &middot; Readhouse</title>
</svelte:head>

<main class="error">
	<EmptyState level={1} {title}>
		{#if missing}
			{book
				? 'It is not in your library any more; it may have been removed on another device.'
				: 'The link may be old, or mistyped.'}
		{:else}
			Readhouse couldn&rsquo;t open this. Try again in a moment.
		{/if}
		{#snippet action()}
			<Button variant="outline" icon="back" href={resolve('/')}>Back to the shelf</Button>
		{/snippet}
	</EmptyState>
</main>

<style>
	.error {
		padding: calc(var(--space-7) + var(--safe-top)) var(--space-5);
	}
</style>
