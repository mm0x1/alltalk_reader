<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BookSummary } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import { placeInBook } from './place.js';

	let { book, onremove }: { book: BookSummary; onremove: () => void } = $props();
</script>

<article class="row">
	<a class="open" href={resolve('/book/[id=uuid]', { id: book.id })}>
		{#if book.hasCover}
			<img
				class="mark cover"
				src={`/api/books/${book.id}/cover`}
				alt=""
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<span class="mark initial" aria-hidden="true">{book.title.slice(0, 1)}</span>
		{/if}
		<span class="text">
			<span class="title">{book.title}</span>
			<span class="detail">
				{#if book.author}{book.author} &middot;
				{/if}{placeInBook(book)}
			</span>
		</span>
	</a>
	<Button icon="trash" aria-label={`Remove ${book.title}`} onclick={onremove} />
</article>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) 0;
		border-top: var(--border-thin) solid var(--color-rule);
	}

	.open {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
		text-decoration: none;
	}

	.mark {
		flex: none;
		width: var(--tap-min);
	}

	.cover {
		aspect-ratio: 2 / 3;
		object-fit: cover;
		border: var(--border-thin) solid var(--color-rule);
	}

	.initial {
		font-size: var(--text-xl);
		font-style: italic;
		text-align: center;
	}

	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.title {
		font-size: var(--text-l);
		line-height: var(--leading-tight);
	}

	.detail {
		overflow: hidden;
		color: var(--color-ink-muted);
		font-style: italic;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
