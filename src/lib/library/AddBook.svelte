<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/client/api.js';
	import Button from '#lib/ui/Button.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let busy = $state(false);
	let problem = $state<string | null>(null);
	let pasted = $state('');
	let pastedTitle = $state('');

	async function add(work: () => Promise<{ id: string }>) {
		busy = true;
		problem = null;
		try {
			const { id } = await work();
			open = false;
			pasted = pastedTitle = '';
			await goto(resolve('/book/[id=uuid]', { id }));
		} catch (error) {
			problem = error instanceof Error ? error.message : 'That could not be added.';
		} finally {
			busy = false;
		}
	}

	export function addFile(file: File) {
		void add(() => api.upload(file));
	}
</script>

<Sheet bind:open title="Add a book">
	<div class="ways">
		<section>
			<h3>From a file</h3>
			<p class="hint">EPUB or plain text (.txt). AO3 downloads work too.</p>
			<label class="file">
				<input
					type="file"
					accept=".epub,.txt,application/epub+zip,text/plain"
					disabled={busy}
					onchange={(event) => {
						const file = event.currentTarget.files?.[0];
						event.currentTarget.value = '';
						if (file) addFile(file);
					}}
				/>
				<span>Choose a file</span>
			</label>
		</section>

		<section>
			<h3>Paste text</h3>
			<p class="hint">Paste a story, or a whole AO3 chapter page (select all, copy).</p>
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void add(() => api.paste(pasted, pastedTitle.trim() || null));
				}}
			>
				<label class="visually-hidden" for="paste-title">Title (optional)</label>
				<input id="paste-title" placeholder="Title (optional)" bind:value={pastedTitle} />
				<label class="visually-hidden" for="paste-text">Text</label>
				<textarea id="paste-text" rows="6" placeholder="Paste here" bind:value={pasted}></textarea>
				<Button type="submit" variant="primary" disabled={busy || !pasted.trim()}>Add</Button>
			</form>
		</section>

		{#if busy}
			<p class="status" role="status">Adding&hellip;</p>
		{/if}
		{#if problem}
			<p class="status problem" role="alert">{problem}</p>
		{/if}
	</div>
</Sheet>

<style>
	.ways {
		display: grid;
		gap: var(--space-5);
	}

	h3 {
		margin: 0 0 var(--space-1);
		font-size: var(--text-m);
		font-weight: var(--weight-bold);
	}

	.hint {
		margin-bottom: var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--text-s);
	}

	.file {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(var(--tap-min) * 1.5);
		border: var(--border-thin) dashed var(--color-rule);
		border-radius: var(--radius-m);
		font-weight: var(--weight-medium);
		cursor: pointer;
	}

	.file:focus-within {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}

	.file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	form {
		display: grid;
		gap: var(--space-2);
	}

	input:not([type='file']),
	textarea {
		width: 100%;
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-3);
		border: var(--border-thin) solid var(--color-rule);
		border-radius: var(--radius-s);
		background: var(--color-paper);
		/* At least 16px, or iOS zooms in on focus. */
		font-size: var(--text-m);
	}

	textarea {
		resize: vertical;
		font-family: var(--font-reading);
	}

	.status {
		color: var(--color-ink-muted);
	}

	.problem {
		color: var(--color-danger);
	}
</style>
