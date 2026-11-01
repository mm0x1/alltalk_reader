<script lang="ts">
	import Reader from '#lib/reader/Reader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.book.title} &middot; Readhouse</title>
</svelte:head>

{#key data.book.id}
	<Reader book={data.book} chapter={data.chapter} start={data.start} />
{/key}
