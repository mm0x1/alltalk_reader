<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	let {
		open = $bindable(false),
		title,
		alert = false,
		children,
		actions
	}: {
		open?: boolean;
		title: string;
		/** A question that needs an answer (see Confirm): no close button, buttons at the end. */
		alert?: boolean;
		children: Snippet;
		/** Full-width buttons under the body, within thumb reach. */
		actions?: Snippet;
	} = $props();

	const titleId = $props.id();

	/** Keeps the native dialog in step with `open`; re-runs whenever `open` changes. */
	function sync(dialog: HTMLDialogElement) {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	}
</script>

<!-- A native modal dialog: focus trap, Escape and an inert page come from the browser. -->
<dialog
	{@attach sync}
	role={alert ? 'alertdialog' : undefined}
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === event.currentTarget) open = false;
	}}
>
	<div class={['sheet', alert && 'alert']}>
		<header>
			<h2 id={titleId}>{title}</h2>
			{#if !alert}<Button icon="close" aria-label="Close" onclick={() => (open = false)} />{/if}
		</header>
		<div class="body">
			{@render children()}
		</div>
		{#if actions}
			<div class="actions">{@render actions()}</div>
		{/if}
	</div>
</dialog>

<style>
	dialog {
		width: 100%;
		max-width: 100%;
		max-height: 85dvh;
		margin: auto auto 0;
		padding: 0;
		border: none;
		border-top: var(--border-double) double var(--color-rule);
		border-radius: 0;
		background: var(--color-paper-raised);
		color: var(--color-ink);
		box-shadow: var(--shadow-overlay);
	}

	dialog::backdrop {
		background: var(--color-scrim);
	}

	.sheet {
		display: flex;
		flex-direction: column;
		max-height: 85dvh;
		padding-bottom: var(--safe-bottom);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
		border-bottom: var(--border-thin) solid var(--color-rule-soft);
	}

	h2 {
		font-size: var(--text-l);
		font-weight: var(--weight-medium);
		font-style: italic;
	}

	.alert header {
		padding: var(--space-4) var(--space-5) var(--space-2);
		border-bottom: none;
	}

	.alert .body {
		padding-top: 0;
	}

	.actions {
		display: grid;
		gap: var(--space-2);
		padding: 0 var(--space-5) var(--space-5);
	}

	.actions :global(.button) {
		width: 100%;
	}

	.body {
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: var(--space-4) var(--space-5) var(--space-5);
	}

	@media (min-width: 48rem) {
		dialog {
			width: min(var(--sheet-width), 100% - var(--space-6));
			margin: auto;
			border: var(--border-thin) solid var(--color-rule);
			outline: var(--border-double) double var(--color-rule);
			outline-offset: var(--space-1);
		}
	}
</style>
