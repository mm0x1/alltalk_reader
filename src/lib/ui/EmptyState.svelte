<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A page with nothing to show yet, or nothing at all: what happened, in a line, and what to
	 * do next. `level` sets the heading level (1 when it is the whole page).
	 */
	let {
		title,
		level = 2,
		children,
		action
	}: { title: string; level?: 1 | 2; children?: Snippet; action?: Snippet } = $props();
</script>

<div class="empty">
	<svelte:element this={`h${level}`} class="title">{title}</svelte:element>
	{#if children}<p>{@render children()}</p>{/if}
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: grid;
		gap: var(--space-2);
		justify-items: center;
		max-width: var(--measure);
		margin: var(--space-7) auto;
		color: var(--color-ink-muted);
		text-align: center;
		text-wrap: balance;
	}

	.title {
		color: var(--color-ink);
		font-size: var(--text-l);
		font-weight: var(--weight-regular);
		font-style: italic;
	}

	.action {
		margin-top: var(--space-3);
	}
</style>
