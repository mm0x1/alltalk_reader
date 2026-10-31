<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A small ruled tag beside a label, such as "Experimental". */
	let { children }: { children: Snippet } = $props();
</script>

<span class="badge">{@render children()}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0 var(--space-1);
		border: var(--border-thin) solid var(--color-rule);
		font-size: var(--text-xs);
		font-weight: var(--weight-regular);
		font-style: normal;
		font-variant-caps: all-small-caps;
		letter-spacing: var(--tracking-display);
		line-height: var(--leading-ui);
		vertical-align: middle;
	}
</style>
