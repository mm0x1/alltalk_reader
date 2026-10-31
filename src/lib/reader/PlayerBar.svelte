<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { RATES, type Player } from './player.svelte.js';

	let { player }: { player: Player } = $props();

	let sleepOpen = $state(false);
	let now = $state(Date.now());

	// Tick only while a timed sleep is set, to show the minutes left.
	$effect(() => {
		if (player.sleep?.kind !== 'minutes') return;
		now = Date.now();
		const tick = setInterval(() => (now = Date.now()), 15_000);
		return () => clearInterval(tick);
	});

	const sleepLabel = $derived.by(() => {
		const sleep = player.sleep;
		if (!sleep) return null;
		if (sleep.kind === 'chapter') return 'End of chapter';
		return `${Math.max(1, Math.ceil((sleep.endsAt - now) / 60_000))} min`;
	});

	function chooseSleep(choice: number | 'chapter' | null) {
		player.setSleepTimer(choice);
		sleepOpen = false;
	}

	function cycleRate() {
		const index = RATES.indexOf(player.rate as (typeof RATES)[number]);
		player.setRate(RATES[(index + 1) % RATES.length]);
	}
</script>

<div class="bar" role="region" aria-label="Playback">
	{#if player.message}
		<p class={['message', player.status !== 'error' && 'quiet']} role="status">
			{player.message}
		</p>
	{:else if player.status === 'loading'}
		<p class="message quiet" role="status">Preparing the next passage&hellip;</p>
	{/if}
	<div class="controls">
		<Button class="rate" variant="quiet" onclick={cycleRate} aria-label="Reading speed">
			{player.rate}&times;
		</Button>
		<Button
			icon="previous"
			aria-label="Previous passage"
			aria-keyshortcuts="ArrowLeft"
			onclick={() => player.previous()}
		/>
		<Button
			variant="primary"
			class="play"
			icon={player.active ? 'pause' : 'play'}
			aria-label={player.active ? 'Pause' : 'Play'}
			aria-keyshortcuts="Space"
			onclick={() => player.toggle()}
		/>
		<Button
			icon="next"
			aria-label="Next passage"
			aria-keyshortcuts="ArrowRight"
			onclick={() => player.next()}
		/>
		<Button
			class="sleep"
			icon={sleepLabel ? undefined : 'sleep'}
			aria-label={sleepLabel ? `Sleep timer: ${sleepLabel}` : 'Sleep timer'}
			onclick={() => (sleepOpen = true)}
		>
			{#if sleepLabel}<span class="sleep-label">{sleepLabel}</span>{/if}
		</Button>
	</div>
</div>

<Sheet bind:open={sleepOpen} title="Sleep timer">
	<ul class="choices">
		{#each [10, 20, 30, 45, 60] as minutes (minutes)}
			<li>
				<Button variant="outline" onclick={() => chooseSleep(minutes)}>{minutes} minutes</Button>
			</li>
		{/each}
		<li>
			<Button variant="outline" onclick={() => chooseSleep('chapter')}>End of chapter</Button>
		</li>
		{#if player.sleep}
			<li><Button variant="danger" onclick={() => chooseSleep(null)}>Turn off</Button></li>
		{/if}
	</ul>
</Sheet>

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
	.controls :global(.sleep) {
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

	.sleep-label {
		font-size: var(--text-xs);
		line-height: var(--leading-tight);
		white-space: normal;
	}

	.choices {
		display: grid;
		gap: var(--space-2);
	}

	.choices :global(.button) {
		width: 100%;
	}
</style>
