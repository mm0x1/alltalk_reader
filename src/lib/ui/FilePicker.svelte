<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	/** A large dashed target that opens the file chooser; hands over one file. */
	let {
		label,
		onpick,
		...rest
	}: Omit<HTMLInputAttributes, 'type' | 'onchange'> & {
		label: string;
		onpick: (file: File) => void;
	} = $props();
</script>

<label class="file">
	<input
		type="file"
		onchange={(event) => {
			const file = event.currentTarget.files?.[0];
			event.currentTarget.value = '';
			if (file) onpick(file);
		}}
		{...rest}
	/>
	<span>{label}</span>
</label>

<style>
	.file {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(var(--tap-min) * 1.5);
		border: var(--border-thin) dashed var(--color-rule);
		font-weight: var(--weight-medium);
		cursor: pointer;
	}

	.file:focus-within {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}

	.file:has(input:disabled) {
		opacity: 0.45;
		cursor: default;
	}

	input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: inherit;
	}
</style>
