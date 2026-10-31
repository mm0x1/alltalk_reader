<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Field from './Field.svelte';

	/** A labelled range on an engraved rule; `after` shows the value (and e.g. a Reset). */
	let {
		id,
		label,
		value = $bindable(0),
		after,
		...rest
	}: Omit<HTMLInputAttributes, 'type' | 'value'> & {
		id: string;
		label: string;
		value?: number;
		after?: Snippet;
	} = $props();
</script>

<Field {id} {label}>
	<input {id} type="range" bind:value {...rest} />
	{#if after}<p class="after">{@render after()}</p>{/if}
</Field>

<style>
	input {
		width: 100%;
		min-height: var(--tap-min);
		margin: 0;
		background: none;
		appearance: none;
		cursor: pointer;
	}

	input::-webkit-slider-runnable-track {
		height: var(--border-thin);
		background: var(--color-rule);
	}

	input::-moz-range-track {
		height: var(--border-thin);
		background: var(--color-rule);
	}

	/* A square plate as the thumb, on the rule. */
	input::-webkit-slider-thumb {
		width: var(--control-mark);
		height: var(--control-mark);
		margin-top: calc(var(--control-mark) / -2);
		border: var(--border-double) double var(--color-paper);
		background: var(--color-ink);
		appearance: none;
	}

	input::-moz-range-thumb {
		width: var(--control-mark);
		height: var(--control-mark);
		border: var(--border-double) double var(--color-paper);
		border-radius: 0;
		background: var(--color-ink);
	}

	.after {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-ink-muted);
		font-size: var(--text-s);
		font-style: italic;
	}
</style>
