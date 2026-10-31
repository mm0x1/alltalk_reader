<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	/** One choice of several, as a round ballot mark; group several with the same `name`. */
	let { label, ...rest }: Omit<HTMLInputAttributes, 'type'> & { label: string } = $props();
</script>

<label class="choice">
	<input type="radio" {...rest} />
	<span>{label}</span>
</label>

<style>
	.choice {
		display: flex;
		align-items: center;
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
		margin: 0;
		border: var(--border-thin) solid var(--color-rule);
		border-radius: var(--radius-round);
		background: var(--color-paper);
		appearance: none;
		cursor: pointer;
	}

	input::after {
		content: '';
		width: calc(var(--control-mark) / 2);
		height: calc(var(--control-mark) / 2);
		border-radius: var(--radius-round);
		background: var(--color-ink);
		transform: scale(0);
		transition: transform var(--duration-fast) var(--ease-out);
	}

	input:checked::after {
		transform: scale(1);
	}

	@media (prefers-reduced-motion: reduce) {
		input::after {
			transition: none;
		}
	}
</style>
