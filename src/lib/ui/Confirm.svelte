<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';
	import Sheet from './Sheet.svelte';

	/**
	 * Asks before something that can't be undone, as a sheet from below with full-width buttons.
	 * Focus starts on the safe answer; Escape and the scrim also mean no.
	 */
	let {
		open = $bindable(false),
		title,
		confirmLabel,
		cancelLabel = 'Keep it',
		onconfirm,
		children
	}: {
		open?: boolean;
		title: string;
		confirmLabel: string;
		cancelLabel?: string;
		onconfirm: () => void;
		children: Snippet;
	} = $props();
</script>

<Sheet bind:open {title} alert>
	<p class="message">{@render children()}</p>
	{#snippet actions()}
		<Button
			variant="danger-solid"
			onclick={() => {
				open = false;
				onconfirm();
			}}>{confirmLabel}</Button
		>
		<Button variant="outline" autofocus onclick={() => (open = false)}>{cancelLabel}</Button>
	{/snippet}
</Sheet>

<style>
	.message {
		font-size: var(--text-m);
		line-height: var(--leading-ui);
	}
</style>
