<script lang="ts">
	import ToastSlug from './ToastSlug.svelte';
	import { toasts } from './toasts.svelte.js';

	const notices = $derived(toasts.items.filter((toast) => !toast.problem));
	const problems = $derived(toasts.items.filter((toast) => toast.problem));
</script>

<!--
	Reverse-ink slugs above the player (or the foot of the page). Both lists are always in the
	page, so screen readers announce what is added: problems at once, the rest politely.
-->
<div class="toaster">
	<ol aria-live="assertive" aria-label="Problems">
		{#each problems as toast (toast.id)}<li><ToastSlug {toast} /></li>{/each}
	</ol>
	<ol aria-live="polite" aria-label="Notices">
		{#each notices as toast (toast.id)}<li><ToastSlug {toast} /></li>{/each}
	</ol>
</div>

<style>
	.toaster {
		position: fixed;
		inset: auto 0 calc(var(--frame-inner) + var(--space-4) + var(--safe-bottom))
			var(--toast-side, 0);
		z-index: var(--layer-overlay);
		display: grid;
		gap: var(--space-2);
		justify-items: center;
		padding: 0 var(--space-5);
		pointer-events: none;
	}

	/* Above the reader's player, and beside its desktop sidebar. */
	:global(body:has([data-player])) .toaster {
		bottom: calc(var(--player-height) + var(--space-3) + var(--safe-bottom));
	}

	/* Above the mini player on the shelf: its height is one tap target plus padding and rules. */
	:global(body:has([data-mini-player])) .toaster {
		bottom: calc(
			var(--space-5) + var(--safe-bottom) + var(--tap-min) + var(--space-2) * 3 +
				var(--border-double) * 2
		);
	}

	@media (min-width: 64rem) {
		:global(body:has([data-player])) .toaster {
			--toast-side: var(--sidebar-width);
		}
	}

	ol {
		display: grid;
		gap: var(--space-2);
		width: min(100%, var(--measure));
	}

	ol:empty {
		display: none;
	}
</style>
