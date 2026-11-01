<script lang="ts">
	import Reader from '#lib/reader/Reader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.book.title} &middot; Readhouse</title>
</svelte:head>

<!-- A new player when the book or its passage length changes (preparing it can change that). -->
{#key `${data.book.id}:${data.passageChars}`}
	<Reader book={data.book} chapter={data.chapter} start={data.start} />
{/key}
