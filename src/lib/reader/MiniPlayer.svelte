<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '#lib/ui/Button.svelte';
	import type { Player } from './player.svelte.js';

	let { player }: { player: Player } = $props();

	const chapterTitle = $derived(player.book.chapters[player.position.chapter]?.title ?? '');
</script>

<aside class="mini" aria-label="Now reading" data-mini-player>
	<a class="book" href={resolve('/book/[id=uuid]', { id: player.book.id })}>
		<span class="title">{player.book.title}</span>
		<span class="chapter">{chapterTitle}</span>
	</a>
	<Button
		variant="primary"
		icon={player.active ? 'pause' : 'play'}
		aria-label={player.active ? 'Pause' : 'Play'}
		onclick={() => player.toggle()}
	/>
</aside>

<style>
	/* A small engraved plate inside the page frame: square corners, a ruled double border. */
	.mini {
		position: fixed;
		inset: auto var(--space-5) calc(var(--space-5) + var(--safe-bottom));
		z-index: var(--layer-player);
		display: flex;
		align-items: center;
		gap: var(--space-3);
		max-width: var(--measure);
		margin: 0 auto;
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		border: var(--border-double) double var(--color-rule);
		background: var(--color-paper);
	}

	.book {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		text-decoration: none;
	}

	.title,
	.chapter {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		font-weight: var(--weight-medium);
	}

	.chapter {
		color: var(--color-ink-muted);
		font-size: var(--text-s);
		font-style: italic;
	}
</style>
