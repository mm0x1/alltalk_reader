<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/client/api.js';
	import Button from '#lib/ui/Button.svelte';

	let passcode = $state('');
	let busy = $state(false);
	let problem = $state<string | null>(null);

	/** Only same-site paths, so the link can't send someone elsewhere after unlocking. */
	function destination(): string {
		const next = page.url.searchParams.get('next') ?? '/';
		return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
	}

	async function unlock(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		problem = null;
		try {
			await api.unlock(passcode);
			// `destination()` only returns same-site paths checked above.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(destination(), { replaceState: true, invalidateAll: true });
		} catch (error) {
			problem = error instanceof Error ? error.message : 'Could not unlock.';
			passcode = '';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Unlock &middot; Readhouse</title>
</svelte:head>

<main class="unlock">
	<h1>Readhouse</h1>
	<form onsubmit={unlock}>
		<label for="passcode">Passcode</label>
		<input
			id="passcode"
			type="password"
			autocomplete="current-password"
			required
			bind:value={passcode}
		/>
		<Button type="submit" variant="primary" disabled={busy || !passcode}>Unlock</Button>
		{#if problem}<p class="problem" role="alert">{problem}</p>{/if}
	</form>
</main>

<style>
	.unlock {
		display: grid;
		gap: var(--space-5);
		max-width: var(--form-narrow);
		margin: 0 auto;
		padding: calc(var(--space-8) + var(--safe-top)) var(--space-4);
		text-align: center;
	}

	h1 {
		font-family: var(--font-reading);
		font-size: var(--text-2xl);
	}

	form {
		display: grid;
		gap: var(--space-3);
		text-align: start;
	}

	label {
		font-weight: var(--weight-medium);
	}

	input {
		min-height: var(--tap-min);
		padding: 0 var(--space-3);
		border: var(--border-thin) solid var(--color-rule);
		border-radius: var(--radius-s);
		background: var(--color-paper-raised);
		font-size: var(--text-m);
	}

	.problem {
		color: var(--color-danger);
	}
</style>
