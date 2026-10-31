<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A label above a control and an optional hint below it; the control comes as children. */
	let {
		id,
		label,
		hint,
		hideLabel = false,
		children
	}: {
		/** The control's id, which the label points at. */
		id: string;
		label: string;
		hint?: string;
		/** Keep the label for screen readers only (the placeholder says it on screen). */
		hideLabel?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="field">
	<label class={['label', hideLabel && 'visually-hidden']} for={id}>{label}</label>
	{@render children()}
	{#if hint}<p class="hint" id={`${id}-hint`}>{hint}</p>{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
		width: 100%;
	}

	.label {
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.hint {
		color: var(--color-ink-muted);
		font-size: var(--text-s);
		font-style: italic;
	}
</style>
