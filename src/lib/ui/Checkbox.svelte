<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	/** An on/off choice as a ballot box, with its label and an optional hint beside it. */
	let {
		id,
		label,
		hint,
		badge,
		checked = $bindable(false),
		...rest
	}: Omit<HTMLInputAttributes, 'type'> & {
		id: string;
		label: string;
		hint?: string;
		/** Shown after the label, e.g. a Badge. */
		badge?: Snippet;
	} = $props();
</script>

<label class="check" for={id}>
	<input
		{id}
		type="checkbox"
		bind:checked
		aria-describedby={hint ? `${id}-hint` : undefined}
		{...rest}
	/>
	<span class="text">
		<span class="label">{label} {@render badge?.()}</span>
		{#if hint}<span class="hint" id={`${id}-hint`}>{hint}</span>{/if}
	</span>
</label>

<style>
	.check {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--tap-min);
		cursor: pointer;
	}

	input {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--control-mark);
		height: var(--control-mark);
		margin: var(--space-1) 0 0;
		border: var(--border-thin) solid var(--color-rule);
		border-radius: 0;
		background: var(--color-paper);
		appearance: none;
		cursor: pointer;
	}

	/* The tick: a solid square, like a filled-in ballot. */
	input::after {
		content: '';
		width: calc(var(--control-mark) / 2);
		height: calc(var(--control-mark) / 2);
		background: var(--color-ink);
		transform: scale(0);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	input:checked::after {
		transform: scale(1);
	}

	input:disabled {
		opacity: 0.45;
	}

	.text {
		display: grid;
		gap: var(--space-1);
	}

	.label {
		font-weight: var(--weight-medium);
	}

	.hint {
		color: var(--color-ink-muted);
		font-size: var(--text-s);
		font-style: italic;
	}

	@media (prefers-reduced-motion: reduce) {
		input::after {
			transition: none;
		}
	}
</style>
