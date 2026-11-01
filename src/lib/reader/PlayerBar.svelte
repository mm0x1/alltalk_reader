<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { toRoman } from '#lib/text/roman.js';
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

	/** How far through the chapter, by passage. */
	const progress = $derived.by(() => {
		const chapter = player.chapter;
		if (!chapter || chapter.position !== player.position.chapter) return 0;
		return Math.round((player.position.block / Math.max(1, chapter.blocks.length - 1)) * 100);
	});

	function cycleRate() {
		const index = RATES.indexOf(player.rate as (typeof RATES)[number]);
		player.setRate(RATES[(index + 1) % RATES.length]);
	}
</script>

<div class="bar" role="region" aria-label="Playback" data-player>
	{#if player.message}
		<p class={['message', player.status !== 'error' && 'quiet']} role="status">
			{player.message}
		</p>
	{:else if player.status === 'loading'}
		<p class="message quiet" role="status">Preparing the next passage&hellip;</p>
	{/if}
	<div class="progress">
		<span>Ch. {toRoman(player.position.chapter + 1)}</span>
		<span class="rule" aria-hidden="true"
			><span class="filled" style:width={`${progress}%`}></span></span
		>
		<span>of {toRoman(player.book.chapterCount)}</span>
	</div>
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
		/* Beside the reader's desktop sidebar, if there is one. */
		inset: auto 0 0 var(--reader-side, 0);
		z-index: var(--layer-player);
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-6) calc(var(--space-5) + var(--safe-bottom));
		background: var(--color-paper);
	}

	.progress,
	.controls {
		width: 100%;
		max-width: var(--measure);
		margin: 0 auto;
	}

	.progress {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-display);
		font-variant-numeric: tabular-nums;
	}

	.rule {
		position: relative;
		flex: 1;
		height: var(--border-thin);
		background: var(--color-rule);
	}

	.filled {
		position: absolute;
		inset: calc(var(--border-thin) * -1) auto calc(var(--border-thin) * -1) 0;
		background: var(--color-rule);
		transition: width var(--duration-medium) var(--ease-out);
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.controls :global(.play) {
		min-width: calc(var(--tap-min) * 1.45);
		min-height: calc(var(--tap-min) * 1.45);
		border-radius: var(--radius-round);
		outline: var(--border-double) double var(--color-rule);
		outline-offset: var(--space-1);
	}

	.controls :global(.rate),
	.controls :global(.sleep) {
		width: calc(var(--tap-min) * 1.4);
		font-variant-caps: normal;
		font-style: italic;
		font-variant-numeric: tabular-nums;
	}

	.message {
		max-width: var(--measure);
		margin: 0 auto;
		color: var(--color-danger);
		font-size: var(--text-s);
		text-align: center;
	}

	.message.quiet {
		color: var(--color-ink-muted);
		font-style: italic;
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
