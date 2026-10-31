<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { api } from '#lib/client/api.js';
	import Button from '#lib/ui/Button.svelte';
	import FilePicker from '#lib/ui/FilePicker.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import TextField from '#lib/ui/TextField.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let busy = $state(false);
	let problem = $state<string | null>(null);
	let pasted = $state('');
	let pastedTitle = $state('');
	/** A file shared from another app, waiting for the reader to confirm it. */
	let sharedFile = $state<File | null>(null);

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
		sharedFile = null;
		void add(() => api.upload(file));
	}

	/*
	 * Shared from another app. Never added without a tap: any website can POST to the share
	 * target, so what arrives there is only offered, like a file the reader still has to confirm.
	 */
	export function offerFile(file: File) {
		problem = null;
		sharedFile = file;
	}

	export function offerText(text: string, title: string) {
		problem = null;
		pasted = text;
		pastedTitle = title;
	}

	/** A link was shared: Readhouse never fetches web pages, so say what works instead. */
	export function explainLink() {
		problem =
			'Readhouse can\u2019t open web links. On AO3, download the work as EPUB and share the file, or copy the whole page and paste it here.';
	}
</script>

<Sheet bind:open title="Add a book">
	<div class="ways">
		<section>
			<h3>From a file</h3>
			<p class="hint">EPUB or plain text (.txt). AO3 downloads work too.</p>
			{#if sharedFile}
				{@const file = sharedFile}
				<div class="shared">
					<p>Shared with Readhouse: <span class="file-name">{file.name}</span></p>
					<Button variant="primary" disabled={busy} onclick={() => addFile(file)}>
						Add this book
					</Button>
				</div>
			{:else}
				<FilePicker
					label="Choose a file"
					accept=".epub,.txt,application/epub+zip,text/plain"
					disabled={busy}
					onpick={addFile}
				/>
			{/if}
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
				<TextField
					id="paste-title"
					label="Title (optional)"
					hideLabel
					placeholder="Title (optional)"
					bind:value={pastedTitle}
				/>
				<TextField
					id="paste-text"
					label="Text"
					hideLabel
					multiline
					rows={6}
					placeholder="Paste here"
					bind:value={pasted}
				/>
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

	form {
		display: grid;
		gap: var(--space-2);
	}

	.shared {
		display: grid;
		gap: var(--space-3);
		justify-items: start;
		padding: var(--space-3);
		border: var(--border-thin) solid var(--color-rule);
	}

	.file-name {
		font-style: italic;
		overflow-wrap: anywhere;
	}

	.status {
		color: var(--color-ink-muted);
	}

	.problem {
		color: var(--color-danger);
	}
</style>
