<script lang="ts">
	import type { HTMLInputAttributes, HTMLTextareaAttributes } from 'svelte/elements';
	import Field from './Field.svelte';

	/** A labelled text input in a ruled box; `multiline` makes it a text area. */
	let {
		id,
		label,
		hint,
		hideLabel = false,
		multiline = false,
		value = $bindable(''),
		...rest
	}: (HTMLInputAttributes & HTMLTextareaAttributes) & {
		id: string;
		label: string;
		hint?: string;
		hideLabel?: boolean;
		multiline?: boolean;
		value?: string;
	} = $props();

	const describedBy = $derived(hint ? `${id}-hint` : undefined);
</script>

<Field {id} {label} {hint} {hideLabel}>
	{#if multiline}
		<textarea {id} bind:value aria-describedby={describedBy} {...rest}></textarea>
	{:else}
		<input {id} bind:value aria-describedby={describedBy} {...rest} />
	{/if}
</Field>

<style>
	input,
	textarea {
		width: 100%;
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-3);
		border: var(--border-thin) solid var(--color-rule);
		border-radius: 0;
		background: var(--color-paper);
		/* At least 16px, or iOS zooms in on focus. */
		font-size: var(--text-m);
	}

	textarea {
		resize: vertical;
		font-family: var(--font-reading);
	}

	::placeholder {
		color: var(--color-ink-muted);
		font-style: italic;
	}
</style>
