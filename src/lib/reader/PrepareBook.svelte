<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '#lib/client/api.js';
	import type { Preparation } from '#lib/library.js';
	import Button from '#lib/ui/Button.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import { toasts } from '#lib/ui/toasts.svelte.js';

	/**
	 * Preparing the whole book on the computer, so it plays even with AllTalk off: every passage
	 * made now with the library's voice settings and AllTalk's model, and kept.
	 */
	let { bookId, onchange }: { bookId: string; onchange: () => void } = $props();

	let status = $state<Preparation | null>(null);
	let loaded = $state(false);
	let busy = $state(false);
	/** Contents is on the page twice (phone sheet, desktop sidebar); only the visible one asks. */
	let root: HTMLElement | undefined = $state();
	const visible = () =>
		document.visibilityState === 'visible' && !!root && root.offsetParent !== null;

	const POLL_MS = 3000;
	/** After Start or Continue: picks progress up (the mount-time loop stops when idle). */
	let wakeAfterAction = () => {};

	onMount(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;
		let stopped = false;
		// Asks once when shown, then every few seconds only while preparing and on screen. A
		// hidden copy asks nothing until it is shown (the sheet opening, a wider window).
		const poll = async () => {
			if (timer) clearTimeout(timer);
			timer = null;
			if (stopped || !visible()) return;
			const was = status?.state;
			status = await api.preparation(bookId).catch(() => status);
			loaded = true;
			if (was === 'preparing' && status?.state === 'ready') {
				toasts.show('The whole book is prepared: it plays even with AllTalk off.');
			}
			if (status?.state === 'preparing') timer = setTimeout(poll, POLL_MS);
		};
		const wake = () => {
			if (!loaded || status?.state === 'preparing') void poll();
		};
		wakeAfterAction = () => void poll();
		const shown = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) wake();
		});
		if (root) shown.observe(root);
		document.addEventListener('visibilitychange', wake);
		return () => {
			stopped = true;
			if (timer) clearTimeout(timer);
			shown.disconnect();
			document.removeEventListener('visibilitychange', wake);
		};
	});

	async function act(action: 'start' | 'continue' | 'stop' | 'forget') {
		busy = true;
		try {
			const before = status?.passageChars;
			status = await api.prepare(bookId, action);
			// The book is now read with other settings (and maybe another passage length).
			if (action === 'start' || action === 'forget' || before !== status?.passageChars) onchange();
			if (status?.state === 'preparing') setTimeout(wakeAfterAction, POLL_MS);
		} catch (error) {
			const reason = error instanceof Error ? ` ${error.message}` : '';
			toasts.show(`That didn’t work.${reason}`, { problem: true });
		} finally {
			busy = false;
		}
	}

	const voiceName = (voice: string) =>
		voice
			? voice.replace(/\.(wav|mp3|flac)$/i, '').replace(/[_-]+/g, ' ')
			: 'AllTalk’s default voice';
</script>

<section class={['whole', loaded && 'loaded']} aria-label="Whole book" bind:this={root}>
	{#if loaded}
		{#if !status}
			<p class="note">
				Make every passage now with today&rsquo;s voice settings and keep them, so the book plays
				even with AllTalk off.
			</p>
			<Button variant="outline" icon="save" disabled={busy} onclick={() => act('start')}>
				Prepare the whole book
			</Button>
		{:else if status.state === 'preparing'}
			<p class="note" role="status">
				Preparing the whole book: {status.done.toLocaleString()} of {status.total
					? status.total.toLocaleString()
					: '…'}
				passages
			</p>
			<Progress value={status.done} max={status.total} label="Preparing the whole book" />
			<Button variant="text" disabled={busy} onclick={() => act('stop')}>Stop</Button>
		{:else}
			{#if status.state === 'paused'}
				<p class="note" role="status">
					Paused at {status.done.toLocaleString()} of {status.total.toLocaleString()} passages. {status.message ??
						''}
				</p>
			{:else}
				<p class="note">
					Prepared with {voiceName(status.voice)}{status.model ? `, ${status.model}` : ''}, up to {status.passageChars}
					characters a passage. Plays even with AllTalk off.
				</p>
			{/if}
			<div class="actions">
				{#if status.state === 'paused'}
					<Button variant="outline" disabled={busy} onclick={() => act('continue')}>Continue</Button
					>
				{:else}
					<Button variant="text" disabled={busy} onclick={() => act('start')}>
						Prepare again with current settings
					</Button>
				{/if}
				<Button variant="text" disabled={busy} onclick={() => act('forget')}>Forget</Button>
			</div>
		{/if}
	{/if}
</section>

<style>
	.whole {
		/* Never zero-sized, so the observer sees it appear before anything has loaded. */
		min-height: 1px;
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}

	.loaded {
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: var(--border-thin) solid var(--color-rule-soft);
	}

	.whole :global(.progress) {
		justify-self: stretch;
	}

	.note {
		color: var(--color-ink-muted);
		font-size: var(--text-s);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
