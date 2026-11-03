<script lang="ts">
	import { resolve } from '$app/paths';
	import type { BookSummary } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import { placeInBook } from './place.js';

	let { book, onremove }: { book: BookSummary; onremove: () => void } = $props();
</script>

<article class="row">
	<a
		class={['open', book.author && 'has-author']}
		href={resolve('/book/[id=uuid]', { id: book.id })}
	>
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
				{#if book.author}<span class="author">{book.author}</span>{/if}
				<span class="place">{placeInBook(book)}</span>
			</span>
		</span>
		<span class="leader" aria-hidden="true"></span>
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

	/* Wrap rather than truncate: the place in the book is the useful end of the line. */
	.title,
	.detail {
		overflow-wrap: anywhere;
	}

	.title {
		font-size: var(--text-l);
		line-height: var(--leading-tight);
	}

	.author,
	.place {
		color: var(--color-ink-muted);
		font-style: italic;
	}

	/* "Author · place" on one line; the dot is decoration, so screen readers skip it. */
	.author::after {
		content: ' \00b7 ' / '';
	}

	.leader {
		display: none;
	}

	/*
	 * Desktop, the printed index: title over author on the left, dot leaders running to the
	 * place in the book on the right. No initials or covers; the column is narrow enough.
	 */
	@media (min-width: 64rem) {
		.open {
			display: grid;
			grid-template-columns: fit-content(70%) minmax(var(--space-5), 1fr) auto;
			align-items: baseline;
			column-gap: var(--space-2);
		}

		.mark {
			display: none;
		}

		.text,
		.detail {
			display: contents;
		}

		.title {
			grid-row: 1;
			grid-column: 1;
		}

		/*
		 * Over an author the title also spans the leader's column, so the author alone sizes the
		 * first one and the leader starts right after it, however the title wraps.
		 */
		.has-author .title {
			grid-column: 1 / 3;
			max-width: var(--measure);
		}

		.author {
			grid-row: 2;
			grid-column: 1;
		}

		.author::after {
			content: none;
		}

		.leader,
		.place {
			grid-row: 1;
		}

		.has-author .leader,
		.has-author .place {
			grid-row: 2;
		}

		.leader {
			display: block;
			grid-column: 2;
			align-self: stretch;
			/* Spaced dots on the baseline, as in Contents (ListRow). */
			background-image: radial-gradient(
				circle,
				var(--color-ink-muted) calc(var(--border-leader) / 2),
				transparent calc(var(--border-leader) / 2 + 0.5px)
			);
			background-position: left bottom 0.45em;
			background-size: var(--space-2) var(--space-2);
			background-repeat: space no-repeat;
		}

		.place {
			grid-column: 3;
			white-space: nowrap;
		}
	}
</style>
