<script lang="ts">
	import Button from './Button.svelte';
	import { toasts, type Toast } from './toasts.svelte.js';

	const notices = $derived(toasts.items.filter((toast) => !toast.problem));
	const problems = $derived(toasts.items.filter((toast) => toast.problem));
</script>

<!--
	Reverse-ink slugs above the player (or the foot of the page). Both lists are always in the
	page, so screen readers announce what is added: problems at once, the rest politely.
-->
<div class="toaster">
	<ol aria-live="assertive" aria-label="Problems">
		{#each problems as toast (toast.id)}{@render slug(toast)}{/each}
	</ol>
	<ol aria-live="polite" aria-label="Notices">
		{#each notices as toast (toast.id)}{@render slug(toast)}{/each}
	</ol>
</div>

{#snippet slug(toast: Toast)}
	<li class="toast">
		<p>{toast.message}</p>
		{#if toast.action}
			{@const action = toast.action}
			<Button
				variant="text"
				onclick={() => {
					toasts.dismiss(toast.id);
					action.run();
				}}>{action.label}</Button
			>
		{/if}
		<Button icon="close" aria-label="Dismiss" onclick={() => toasts.dismiss(toast.id)} />
	</li>
{/snippet}

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

	.toast {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
		background: var(--color-ink);
		color: var(--color-paper);
		box-shadow: var(--shadow-overlay);
		pointer-events: auto;
		animation: rise var(--duration-medium) var(--ease-out);
	}

	p {
		flex: 1;
		min-width: 0;
		padding: var(--space-2) 0;
		font-size: var(--text-m);
		line-height: var(--leading-ui);
		overflow-wrap: anywhere;
	}

	/* Buttons are drawn for paper; on ink they take the slug's colours. */
	.toaster .toast :global(.button:is(*, :hover, :focus-visible)) {
		flex: none;
		background: transparent;
		color: inherit;
		outline-color: var(--color-paper);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(var(--space-3));
		}
	}
</style>
