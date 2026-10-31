<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BookSummary } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';

	let { book, onremove }: { book: BookSummary; onremove: () => void } = $props();

	const place = $derived(
		book.progress
			? `Chapter ${book.progress.chapter + 1} of ${book.chapterCount}`
			: `${book.chapterCount} ${book.chapterCount === 1 ? 'chapter' : 'chapters'} · not started`
	);
</script>

<article class="row">
	<a class="open" href={resolve('/book/[id=uuid]', { id: book.id })}>
		{#if book.hasCover}
			<img
				class="cover"
				src={`/api/books/${book.id}/cover`}
				alt=""
				loading="lazy"
				decoding="async"
			/>
		{:else}
			<span class="cover placeholder" aria-hidden="true">{book.title.slice(0, 1)}</span>
		{/if}
		<span class="text">
			<span class="title">{book.title}</span>
			{#if book.author}<span class="author">{book.author}</span>{/if}
			<span class="place">{place}</span>
		</span>
	</a>
	<Button icon="trash" aria-label={`Remove ${book.title}`} onclick={onremove} />
</article>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-m);
		background: var(--color-paper-raised);
	}

	.open {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
		border-radius: var(--radius-s);
		text-decoration: none;
	}

	.cover {
		flex: none;
		width: var(--cover-width);
		aspect-ratio: 2 / 3;
		border-radius: var(--radius-s);
		object-fit: cover;
		background: var(--color-paper-sunken);
	}

	.placeholder {
		display: grid;
		place-items: center;
		color: var(--color-ink-faint);
		font-family: var(--font-reading);
		font-size: var(--text-2xl);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.title {
		display: -webkit-box;
		overflow: hidden;
		font-family: var(--font-reading);
		font-size: var(--text-l);
		line-height: var(--leading-tight);
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.author,
	.place {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.author {
		color: var(--color-ink-muted);
	}

	.place {
		color: var(--color-ink-faint);
		font-size: var(--text-s);
	}
</style>
