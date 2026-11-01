<script lang="ts">
	/**
	 * A hairline rule that fills in ink as work is done, like the player's chapter rule. With
	 * `max` 0 (the total isn't known yet) it is an empty rule and says nothing about a value.
	 */
	let { value, max, label }: { value: number; max: number; label: string } = $props();

	const ratio = $derived(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);
</script>

<div
	class="progress"
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={max > 0 ? max : undefined}
	aria-valuenow={max > 0 ? value : undefined}
>
	<span class="filled" style:transform={`scaleX(${ratio})`}></span>
</div>

<style>
	.progress {
		position: relative;
		height: var(--border-leader);
		overflow: hidden;
		background: var(--color-rule-soft);
	}

	.filled {
		position: absolute;
		inset: 0;
		background: var(--color-rule);
		transform-origin: left;
		transition: transform var(--duration-medium) var(--ease-out);
	}

	.filled:dir(rtl) {
		transform-origin: right;
	}
</style>
