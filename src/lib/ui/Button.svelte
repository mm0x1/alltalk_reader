<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	/** With `href` it renders a link that looks like a button. */
	type Props = (HTMLButtonAttributes & HTMLAnchorAttributes) & {
		variant?: 'primary' | 'quiet' | 'outline' | 'danger';
		icon?: IconName;
		/** Without children the button is icon-only and needs an `aria-label`. */
		children?: Snippet;
	};

	let {
		variant = 'quiet',
		icon,
		children,
		type = 'button',
		href,
		class: className,
		...rest
	}: Props = $props();
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	type={href ? undefined : type}
	{href}
	class={['button', variant, !children && 'icon-only', className]}
	{...rest}
>
	{#if icon}<Icon name={icon} />{/if}
	{@render children?.()}
</svelte:element>

<style>
	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--tap-min);
		padding: 0 var(--space-4);
		border: var(--border-thin) solid transparent;
		border-radius: var(--radius-round);
		background: transparent;
		font-family: var(--font-ui);
		font-size: var(--text-m);
		font-weight: var(--weight-medium);
		color: inherit;
		text-decoration: none;
		cursor: pointer;
		touch-action: manipulation;
		transition:
			background-color var(--duration-fast) var(--ease-out),
			transform var(--duration-fast) var(--ease-out);
	}

	.button:active:not(:disabled) {
		transform: scale(0.97);
	}

	.button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.icon-only {
		min-width: var(--tap-min);
		padding: 0;
	}

	.primary {
		background: var(--color-accent);
		color: var(--color-accent-ink);
	}

	.quiet {
		color: var(--color-ink);
	}

	.outline {
		border-color: var(--color-rule);
		color: var(--color-ink);
	}

	.danger {
		border-color: var(--color-rule);
		color: var(--color-danger);
	}

	@media (hover: hover) {
		.quiet:hover:not(:disabled),
		.outline:hover:not(:disabled),
		.danger:hover:not(:disabled) {
			background: var(--color-paper-sunken);
		}
	}
</style>
