<script lang="ts">
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import { RATES, type Player } from './player.svelte.js';
	import { bookProgress, readShowProgress } from './progress.js';

	let { player }: { player: Player } = $props();

	let sleepOpen = $state(false);
	let rateOpen = $state(false);
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

	/** Hidden on this device if the reader chose not to know (Settings). */
	const showProgress = readShowProgress();

	/** How far through the book, by words (see progress.ts). */
	const progress = $derived.by(() => {
		const { chapter, position, book } = player;
		const passages = chapter?.position === position.chapter ? chapter.passages.length : 0;
		return bookProgress(book.chapters, position.chapter, position.passage, passages);
	});

	/**
	 * Told to screen readers when it changes: starting, pausing (also from the lock screen or the
	 * sleep timer) and moving on to a new chapter; never each passage.
	 */
	const announcement = $derived.by(() => {
		const title = player.book.chapters[player.position.chapter]?.title ?? '';
		if (player.active) return `Reading ${title}`;
		return player.status === 'paused' ? 'Paused' : '';
	});
</script>

<div class="bar" role="region" aria-label="Playback" data-player>
	<p class="visually-hidden" aria-live="polite">{announcement}</p>
	{#if player.message}
		<p class={['message', player.status !== 'error' && 'quiet']} role="status">
			{player.message}
		</p>
	{:else if player.status === 'loading'}
		<p class="message quiet" role="status"><Spinner /> Preparing the next passage</p>
	{/if}
	{#if showProgress}
		<div class="progress">
			<span>{progress}%</span>
			<span class="rule" aria-hidden="true"
				><span class="filled" style:width={`${progress}%`}></span></span
			>
			<span>of the book</span>
		</div>
	{/if}
	<div class="controls">
		<Button
			class="rate"
			variant="quiet"
			onclick={() => (rateOpen = true)}
			aria-label={`Reading speed: ${player.rate}\u00d7`}
		>
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

<Sheet bind:open={rateOpen} title="Reading speed">
	<ul class="choices rates">
		{#each RATES as rate (rate)}
			<li>
				<Button
					variant={rate === player.rate ? 'primary' : 'outline'}
					aria-pressed={rate === player.rate}
					onclick={() => {
						player.setRate(rate);
						rateOpen = false;
					}}>{rate}&times;</Button
				>
			</li>
		{/each}
	</ul>
</Sheet>

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
		/* Never wider than the screen, whatever the text size (Extra large on a phone). */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		/* Clear of the page frame's rules below, so the play button's ring never touches them. */
		padding: var(--space-3) var(--space-6)
			calc(var(--frame-inner) + var(--space-5) + var(--safe-bottom));
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

	/* Wider for an easy reach, down to the usual tap size when the text is large. */
	.controls :global(.rate),
	.controls :global(.sleep) {
		flex: 0 1 calc(var(--tap-min) * 1.4);
		min-width: var(--tap-min);
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

	/* Speeds side by side: short labels, and all nine in reach without scrolling. */
	.rates {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.choices :global(.button) {
		width: 100%;
	}
</style>
