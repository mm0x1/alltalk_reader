<script lang="ts" module>
	const PATHS = {
		play: 'M8 5.5v13l11-6.5z',
		pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
		previous: 'M7 6v12M18 6l-8 6 8 6z',
		next: 'M17 6v12M6 6l8 6-8 6z',
		contents: 'M4 6h16M4 12h16M4 18h10',
		settings:
			'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
		add: 'M12 5v14M5 12h14',
		close: 'M6 6l12 12M18 6L6 18',
		back: 'M15 5l-7 7 7 7',
		trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
		book: 'M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM17 20H8a3 3 0 0 1 0-6h9',
		follow: 'M12 5v10M7 11l5 5 5-5M5 20h14'
	} as const;
	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	let { name }: { name: IconName } = $props();
	const filled = $derived(name === 'play' || name === 'pause');
</script>

<svg
	class="icon"
	viewBox="0 0 24 24"
	aria-hidden="true"
	fill={filled ? 'currentColor' : 'none'}
	stroke={filled ? 'none' : 'currentColor'}
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	<path d={PATHS[name]} />
</svg>

<style>
	.icon {
		width: 1.25em;
		height: 1.25em;
		flex: none;
	}
</style>
