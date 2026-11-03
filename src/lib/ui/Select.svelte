<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import Field from './Field.svelte';

	/** A labelled dropdown in a ruled box; the options come as children. */
	let {
		id,
		label,
		hint,
		value = $bindable(),
		children,
		...rest
	}: HTMLSelectAttributes & {
		id: string;
		label: string;
		hint?: string;
		children: Snippet;
	} = $props();
</script>

<Field {id} {label} {hint}>
	<span class="box">
		<select {id} bind:value aria-describedby={hint ? `${id}-hint` : undefined} {...rest}>
			{@render children()}
		</select>
	</span>
</Field>

<style>
	.box {
		position: relative;
		display: block;
	}

	/* An engraved chevron. */
	.box::after {
		content: '';
		position: absolute;
		top: 50%;
		right: var(--space-3);
		width: var(--space-2);
		height: var(--space-2);
		border-right: var(--border-thin) solid var(--color-ink);
		border-bottom: var(--border-thin) solid var(--color-ink);
		transform: translateY(-70%) rotate(45deg);
		pointer-events: none;
	}

	select {
		width: 100%;
		min-height: var(--tap-min);
		padding: 0 var(--space-6) 0 var(--space-3);
		border: var(--border-thin) solid var(--color-rule);
		border-radius: 0;
		background: var(--color-paper);
		/* At least 16px, or iOS zooms in on focus. */
		font-size: var(--text-m);
		appearance: none;
		cursor: pointer;
	}

	select:disabled {
		opacity: var(--opacity-disabled);
		cursor: default;
	}
</style>
