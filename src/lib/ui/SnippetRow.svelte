<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { SearchPart } from '#lib/library.js';

	/**
	 * A place found in a book: where it is in spaced capitals, then a few words of its text with
	 * the words asked for marked. The text comes as plain parts, never markup.
	 */
	let {
		label,
		parts,
		...rest
	}: HTMLButtonAttributes & {
		label: string;
		parts: SearchPart[];
	} = $props();
</script>

<button type="button" class="row" {...rest}>
	<span class="label">{label}</span>
	<span class="text"
		>{#each parts as part, index (index)}{#if part.match}<mark>{part.text}</mark
				>{:else}{part.text}{/if}{/each}</span
	>
</button>

<style>
	.row {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-min);
		padding: var(--space-3) var(--space-2);
		border: none;
		border-bottom: var(--border-thin) solid var(--color-rule-soft);
		border-radius: 0;
		background: none;
		text-align: start;
		cursor: pointer;
	}

	.label {
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.text {
		font-family: var(--font-reading);
		line-height: var(--leading-ui);
		overflow-wrap: anywhere;
	}

	/* Bold and underlined, not tinted: a tint is the passage being read. */
	mark {
		background: none;
		color: inherit;
		font-weight: var(--weight-medium);
		text-decoration: underline var(--border-leader);
		text-underline-offset: 0.2em;
	}

	@media (hover: hover) {
		.row:hover {
			background: var(--color-paper-sunken);
		}
	}
</style>
