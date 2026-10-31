<script lang="ts">
	import '@fontsource-variable/eb-garamond/wght.css';
	import '@fontsource-variable/eb-garamond/wght-italic.css';
	import '#lib/design/tokens.css';
	import '#lib/design/base.css';
	import garamondLatin from '@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url';
	import { page } from '$app/state';
	import MiniPlayer from '#lib/reader/MiniPlayer.svelte';
	import { session } from '#lib/reader/session.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const onReader = $derived(page.route.id === '/book/[id=uuid]');
</script>

<svelte:head>
	<link rel="preload" href={garamondLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Readhouse" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<!-- Keep in step with --color-paper in tokens.css (meta tags can't read CSS variables). -->
	<meta name="theme-color" content="#e7eef0" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#1b2232" media="(prefers-color-scheme: dark)" />
</svelte:head>

<!-- The ruled frame of an engraved plate, around every page. Decoration only. -->
<div class="frame" aria-hidden="true"></div>

{@render children()}

{#if session.player && !onReader}
	<MiniPlayer player={session.player} />
{/if}

<style>
	.frame {
		position: fixed;
		inset: calc(var(--safe-top) + var(--frame-outer)) var(--frame-outer)
			calc(var(--safe-bottom) + var(--frame-outer));
		z-index: var(--layer-frame);
		border: var(--border-thin) solid var(--color-rule);
		/* Paper outside the frame, so text scrolls under its edge instead of past it. */
		box-shadow: var(--shadow-frame-mask);
		pointer-events: none;
	}

	.frame::after {
		content: '';
		position: absolute;
		inset: calc(var(--frame-inner) - var(--frame-outer));
		border: var(--border-double) double var(--color-rule);
		opacity: 0.5;
	}
</style>
