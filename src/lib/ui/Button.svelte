<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import Icon, { type IconName } from './Icon.svelte';

	/** With `href` it renders a link that looks like a button. */
	type Props = (HTMLButtonAttributes & HTMLAnchorAttributes) & {
		variant?: 'primary' | 'quiet' | 'outline' | 'danger' | 'danger-solid' | 'text';
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
		border-radius: var(--radius-s);
		background: transparent;
		color: inherit;
		font-family: var(--font-ui);
		font-size: var(--text-m);
		font-weight: var(--weight-medium);
		font-variant-caps: all-small-caps;
		letter-spacing: var(--tracking-display);
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
		opacity: var(--opacity-disabled);
		cursor: default;
	}

	.icon-only {
		min-width: var(--tap-min);
		padding: 0;
	}

	.primary {
		border-color: var(--color-accent);
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
		border-color: var(--color-danger);
		color: var(--color-danger);
	}

	/* The answer to "Remove this book?": the one filled red button. */
	.danger-solid {
		border-color: var(--color-danger);
		background: var(--color-danger);
		color: var(--color-paper);
	}

	/* Inline, like a link in a sentence ("Reset"). Still a full-height tap target. */
	.text {
		padding: 0 var(--space-1);
		font-size: inherit;
		font-weight: var(--weight-regular);
		font-style: italic;
		font-variant-caps: normal;
		letter-spacing: normal;
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	@media (hover: hover) {
		.quiet:hover:not(:disabled),
		.outline:hover:not(:disabled),
		.danger:hover:not(:disabled) {
			background: var(--color-paper-sunken);
		}
	}
</style>
