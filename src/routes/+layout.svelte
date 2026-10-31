<script lang="ts">
	import '#lib/design/tokens.css';
	import '#lib/design/base.css';
	import { page } from '$app/state';
	import MiniPlayer from '#lib/reader/MiniPlayer.svelte';
	import { session } from '#lib/reader/session.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const onReader = $derived(page.route.id === '/book/[id=uuid]');
</script>

<svelte:head>
	<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-title" content="Readhouse" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="theme-color" content="#f6f1e7" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#17150f" media="(prefers-color-scheme: dark)" />
</svelte:head>

{@render children()}

{#if session.player && !onReader}
	<MiniPlayer player={session.player} />
{/if}
