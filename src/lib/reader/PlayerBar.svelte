<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import { RATES, type Player } from './player.svelte.js';

	let { player }: { player: Player } = $props();

	function cycleRate() {
		const index = RATES.indexOf(player.rate as (typeof RATES)[number]);
		player.setRate(RATES[(index + 1) % RATES.length]);
	}
</script>

<div class="bar" role="region" aria-label="Playback">
	{#if player.message}
		<p class="message" role="status">
			{player.message}
		</p>
	{:else if player.status === 'loading'}
		<p class="message quiet" role="status">Preparing the next passage&hellip;</p>
	{/if}
	<div class="controls">
		<Button class="rate" variant="quiet" onclick={cycleRate} aria-label="Reading speed">
			{player.rate}&times;
		</Button>
		<Button icon="previous" aria-label="Previous passage" onclick={() => player.previous()} />
		<Button
			variant="primary"
			class="play"
			icon={player.active ? 'pause' : 'play'}
			aria-label={player.active ? 'Pause' : 'Play'}
			onclick={() => player.toggle()}
		/>
		<Button icon="next" aria-label="Next passage" onclick={() => player.next()} />
		<span class="balance" aria-hidden="true"></span>
	</div>
</div>

<style>
	.bar {
		position: fixed;
		inset: auto 0 0;
		z-index: var(--layer-player);
		padding: var(--space-2) var(--space-4) calc(var(--space-2) + var(--safe-bottom));
		border-top: var(--border-thin) solid var(--color-rule);
		background: var(--color-paper-raised);
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		max-width: var(--measure);
		margin: 0 auto;
	}

	.controls :global(.play) {
		min-width: calc(var(--tap-min) * 1.3);
		min-height: calc(var(--tap-min) * 1.3);
	}

	.controls :global(.rate),
	.balance {
		width: calc(var(--tap-min) * 1.4);
		font-variant-numeric: tabular-nums;
	}

	.message {
		max-width: var(--measure);
		margin: 0 auto var(--space-1);
		color: var(--color-danger);
		font-size: var(--text-s);
		text-align: center;
	}

	.message.quiet {
		color: var(--color-ink-muted);
	}
</style>
