<script lang="ts">
	import Button from './Button.svelte';
	import { toasts, type Toast } from './toasts.svelte.js';

	/** One notice in reverse ink, with its action and a close button (see Toaster). */
	let { toast }: { toast: Toast } = $props();
</script>

<div class="toast">
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
</div>

<style>
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
	/* Doubled class: must beat the button's own hover rule, which has the same weight otherwise. */
	.toast :global(.button.button:is(*, :hover, :focus-visible)) {
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
