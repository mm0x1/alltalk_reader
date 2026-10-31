<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BookSummary } from '#lib/library.js';
	import Icon from '#lib/ui/Icon.svelte';
	import { placeInBook } from './place.js';

	let { book }: { book: BookSummary } = $props();
</script>

<section class="plate" aria-labelledby="continue-heading">
	<a class="open" href={resolve('/book/[id=uuid]', { id: book.id })}>
		{#if book.hasCover}
			<img class="cover" src={`/api/books/${book.id}/cover`} alt="" decoding="async" />
		{:else}
			<span class="cover title-plate" aria-hidden="true">{book.title}</span>
		{/if}
		<span class="text">
			<span class="label" id="continue-heading">
				{book.progress ? 'Continue reading' : 'Begin reading'}
			</span>
			<span class="title">{book.title}</span>
			{#if book.author}<span class="author">{book.author}</span>{/if}
			<span class="place">{placeInBook(book)}</span>
			<span class="listen"><Icon name="play" /> Listen</span>
		</span>
	</a>
</section>

<style>
	.plate {
		border: var(--border-thin) solid var(--color-rule);
		padding: var(--space-4);
	}

	.open {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		text-decoration: none;
	}

	.cover {
		flex: none;
		width: var(--plate-cover-width);
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border: var(--border-double) double var(--color-rule);
	}

	.title-plate {
		display: grid;
		place-items: center;
		padding: var(--space-2);
		overflow: hidden;
		font-size: var(--text-xs);
		font-style: italic;
		line-height: var(--leading-tight);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.label {
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.title {
		font-size: var(--text-l);
		line-height: var(--leading-tight);
	}

	.author,
	.place {
		font-style: italic;
	}

	.place {
		color: var(--color-ink-muted);
	}

	.listen {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		align-self: flex-start;
		min-height: var(--tap-min);
		margin-top: var(--space-2);
		padding: 0 var(--space-4);
		background: var(--color-accent);
		color: var(--color-accent-ink);
		font-variant-caps: all-small-caps;
		letter-spacing: var(--tracking-display);
	}
</style>
