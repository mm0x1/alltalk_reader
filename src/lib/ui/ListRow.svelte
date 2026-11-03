<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * A row in a list you pick from, set like a book's table of contents: the name, a dotted
	 * leader, and a figure on the right. The current row is printed in reverse ink.
	 */
	let {
		title,
		meta,
		current = false,
		...rest
	}: HTMLButtonAttributes & {
		title: string;
		meta?: string;
		current?: boolean;
	} = $props();
</script>

<button type="button" class="row" aria-current={current ? 'true' : undefined} {...rest}>
	<span class="title">{title}</span>
	{#if meta}
		<span class="leader" aria-hidden="true"></span>
		<span class="meta">{meta}</span>
	{/if}
</button>

<style>
	.row {
		display: flex;
		/* A title that wraps keeps its figure and leaders on its last line, as in print. */
		align-items: baseline;
		align-items: last baseline;
		gap: var(--space-2);
		width: 100%;
		min-width: 0;
		min-height: var(--tap-min);
		/* Padding, not spare height, makes up the tap size, so a one-line row stays centred. */
		padding: max(var(--space-2), (var(--tap-min) - 1lh) / 2) var(--space-2);
		border: none;
		border-radius: 0;
		background: none;
		text-align: start;
		cursor: pointer;
	}

	.title {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.leader {
		flex: 1;
		min-width: var(--space-3);
		align-self: stretch;
		/* Spaced dots on the baseline, like a printed table of contents. */
		background-image: radial-gradient(
			circle,
			var(--leader-color) calc(var(--border-leader) / 2),
			transparent calc(var(--border-leader) / 2 + 0.5px)
		);
		background-position: left bottom 0.45em;
		background-size: var(--space-2) var(--space-2);
		background-repeat: space no-repeat;
		--leader-color: var(--color-ink-muted);
	}

	.meta {
		flex: none;
		color: var(--color-ink-muted);
		font-size: var(--text-s);
		font-variant-numeric: oldstyle-nums;
	}

	.row[aria-current='true'] {
		background: var(--color-highlight);
		color: var(--color-highlight-ink);
	}

	.row[aria-current='true'] .meta {
		color: inherit;
	}

	.row[aria-current='true'] .leader {
		--leader-color: var(--color-highlight-ink);
	}

	@media (hover: hover) {
		.row:not([aria-current='true']):hover {
			background: var(--color-paper-sunken);
		}
	}
</style>
