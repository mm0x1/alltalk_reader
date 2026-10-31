<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '#lib/client/api.js';
	import {
		clearOfflineData,
		offlineAvailable,
		storageUse,
		type StorageUse
	} from '#lib/client/offline.js';
	import { applyTheme, readTheme, THEMES, type Theme } from '#lib/design/theme.js';
	import { LANGUAGES, type VoiceSettings } from '#lib/settings.js';
	import type { ServerStatus } from '#lib/status.js';
	import Badge from '#lib/ui/Badge.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Radio from '#lib/ui/Radio.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// A working copy of the saved settings; saved explicitly.
	// svelte-ignore state_referenced_locally
	let voice = $state<VoiceSettings>({ ...data.voice });
	let status = $state<ServerStatus | null>(null);
	let statusError = $state(false);
	let saving = $state(false);
	let saved = $state(false);
	let problem = $state<string | null>(null);
	let theme = $state<Theme>('system');
	let canSave = $state(false);
	let storage = $state<StorageUse | null>(null);

	function megabytes(bytes: number | null): string {
		return bytes === null ? '?' : `${Math.round(bytes / 1024 / 1024).toLocaleString()} MB`;
	}

	async function refreshStorage() {
		storage = await storageUse();
	}

	const engine = $derived(status?.alltalk.engine ?? null);
	const voices = $derived(status?.alltalk.voices ?? []);
	const rvcVoices = $derived(status?.alltalk.rvcVoices ?? []);

	onMount(() => {
		theme = readTheme();
		canSave = offlineAvailable();
		if (canSave) void refreshStorage();
		const controller = new AbortController();
		api
			.status(controller.signal)
			.then((result) => (status = result))
			.catch(() => (statusError = true));
		return () => controller.abort();
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		saved = false;
		problem = null;
		try {
			voice = await api.saveVoice(voice);
			saved = true;
		} catch (error) {
			problem = error instanceof Error ? error.message : 'Could not save.';
		} finally {
			saving = false;
		}
	}

	const LANGUAGE_NAMES: Record<string, string> = {
		auto: 'Detect automatically',
		en: 'English',
		ar: 'Arabic',
		cs: 'Czech',
		de: 'German',
		es: 'Spanish',
		fr: 'French',
		hi: 'Hindi',
		hu: 'Hungarian',
		it: 'Italian',
		ja: 'Japanese',
		ko: 'Korean',
		nl: 'Dutch',
		pl: 'Polish',
		pt: 'Portuguese',
		ru: 'Russian',
		tr: 'Turkish',
		'zh-cn': 'Chinese'
	};

	function voiceLabel(file: string): string {
		return file.replace(/\.(wav|mp3|flac)$/i, '').replace(/[_-]+/g, ' ');
	}
</script>

<svelte:head>
	<title>Settings &middot; Readhouse</title>
</svelte:head>

<header class="top">
	<Button href={resolve('/')} icon="back" aria-label="Library" />
	<h1>Settings</h1>
</header>

<main class="settings">
	<section aria-labelledby="server-heading">
		<h2 id="server-heading">AllTalk</h2>
		{#if status?.alltalk.reachable}
			<p class="state ok">
				{status.alltalk.ready
					? 'Connected'
					: 'Connected, still loading its voice engine'}{#if engine?.model}
					&nbsp;&middot; {engine.model}{/if}
			</p>
		{:else if status || statusError}
			<p class="state problem">
				Readhouse can&rsquo;t reach AllTalk. Check that it&rsquo;s running and that
				<code>ALLTALK_URL</code> points at it.
			</p>
		{:else}
			<p class="state">Checking&hellip;</p>
		{/if}
		<Button variant="outline" onclick={() => api.stopSpeech()}>Stop generating audio</Button>
	</section>

	<form onsubmit={save} aria-labelledby="voice-heading">
		<h2 id="voice-heading">Voice</h2>

		<Select id="voice" label="Voice" bind:value={voice.voice}>
			<option value="">AllTalk&rsquo;s default</option>
			{#each voices as name (name)}
				<option value={name}>{voiceLabel(name)}</option>
			{/each}
		</Select>

		<Select id="language" label="Language" bind:value={voice.language}>
			{#each LANGUAGES as code (code)}
				<option value={code}>{LANGUAGE_NAMES[code] ?? code}</option>
			{/each}
		</Select>

		<Checkbox
			id="narrator"
			label="Narrator"
			hint="A second voice reads everything outside of quotes, so dialogue stands out. It often doesn't work well yet: AllTalk can mix up the voices or skip text, so leave it off unless it sounds right with your voices."
			bind:checked={voice.narratorEnabled}
		>
			{#snippet badge()}<Badge>Experimental</Badge>{/snippet}
		</Checkbox>

		{#if voice.narratorEnabled}
			<Select id="narrator-voice" label="Narrator voice" bind:value={voice.narratorVoice}>
				<option value="">AllTalk&rsquo;s default</option>
				{#each voices as name (name)}
					<option value={name}>{voiceLabel(name)}</option>
				{/each}
			</Select>
			<Select id="unquoted" label="Text outside quotes is read by" bind:value={voice.unquotedIs}>
				<option value="narrator">the narrator</option>
				<option value="character">the main voice</option>
			</Select>
		{/if}

		{#if engine?.capabilities.temperature || engine?.capabilities.repetitionPenalty || rvcVoices.length > 1}
			<details class="advanced">
				<summary>Advanced</summary>
				{#if engine?.capabilities.temperature}
					<Slider
						id="temperature"
						label="Expressiveness (temperature)"
						min="0.1"
						max="1"
						step="0.05"
						bind:value={() => voice.temperature ?? 0.75, (next) => (voice.temperature = next)}
					>
						{#snippet after()}
							{voice.temperature === null ? 'Engine default' : voice.temperature.toFixed(2)}
							<Button variant="text" onclick={() => (voice.temperature = null)}>Reset</Button>
						{/snippet}
					</Slider>
				{/if}
				{#if engine?.capabilities.repetitionPenalty}
					<Slider
						id="repetition-penalty"
						label="Repetition penalty"
						min="1"
						max="20"
						step="0.5"
						bind:value={
							() => voice.repetitionPenalty ?? 10, (next) => (voice.repetitionPenalty = next)
						}
					>
						{#snippet after()}
							{voice.repetitionPenalty === null
								? 'Engine default'
								: voice.repetitionPenalty.toFixed(1)}
							<Button variant="text" onclick={() => (voice.repetitionPenalty = null)}>Reset</Button>
						{/snippet}
					</Slider>
				{/if}
				{#if rvcVoices.length > 1}
					<Select id="rvc-voice" label="RVC voice" bind:value={voice.rvcVoice}>
						{#each rvcVoices as name (name)}
							<option value={name}>{name === 'Disabled' ? 'Off' : name}</option>
						{/each}
					</Select>
					{#if voice.rvcVoice !== 'Disabled'}
						<Slider
							id="rvc-pitch"
							label={`RVC pitch (${voice.rvcPitch})`}
							min="-24"
							max="24"
							step="1"
							bind:value={voice.rvcPitch}
						/>
					{/if}
				{/if}
			</details>
		{/if}

		<p class="note">
			Voice changes apply to passages read from now on. Audio already prepared is kept for when you
			switch back.
		</p>
		<div class="actions">
			<Button type="submit" variant="primary" disabled={saving}>Save voice</Button>
			{#if saved}<span role="status">Saved.</span>{/if}
			{#if problem}<span class="problem" role="alert">{problem}</span>{/if}
		</div>
	</form>

	<section aria-labelledby="appearance-heading">
		<h2 id="appearance-heading">On this device</h2>
		<fieldset class="themes">
			<legend>Theme</legend>
			{#each THEMES as option (option)}
				<Radio
					name="theme"
					value={option}
					label={option === 'system' ? 'Match device' : option[0].toUpperCase() + option.slice(1)}
					checked={theme === option}
					onchange={() => {
						theme = option;
						applyTheme(option);
					}}
				/>
			{/each}
		</fieldset>
		<div class="storage">
			<h3>Offline listening</h3>
			{#if canSave}
				<p class="note">
					Save chapters from a book&rsquo;s Contents to listen without a connection. Readhouse uses
					{megabytes(storage?.usedBytes ?? null)} on this device{#if storage?.persisted}, kept safe
						from automatic clean-up{/if}.
				</p>
				<Button
					variant="danger"
					onclick={async () => {
						if (!confirm('Remove all saved audio and offline copies from this device?')) return;
						await clearOfflineData();
						await refreshStorage();
					}}>Remove offline copies</Button
				>
			{:else}
				<p class="note">
					Offline listening needs a secure connection. Open Readhouse over HTTPS, for example with
					<code>tailscale serve</code>, to save chapters on this device.
				</p>
			{/if}
		</div>
		{#if data.locked}
			<Button
				variant="outline"
				onclick={async () => {
					await clearOfflineData();
					await api.lock();
					await goto(resolve('/unlock'));
				}}>Lock this device</Button
			>
		{/if}
	</section>
</main>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		max-width: var(--measure);
		margin: 0 auto;
		padding: calc(var(--space-5) + var(--safe-top)) var(--space-5) var(--space-2);
	}

	h1 {
		font-family: var(--font-reading);
		font-size: var(--text-xl);
	}

	.settings {
		display: grid;
		gap: var(--space-6);
		max-width: var(--measure);
		margin: 0 auto;
		padding: var(--space-2) var(--space-6) calc(var(--player-height) + var(--space-7));
	}

	section,
	form {
		display: grid;
		gap: var(--space-3);
		justify-items: start;
	}

	h2 {
		font-size: var(--text-l);
		font-family: var(--font-reading);
	}

	.state {
		color: var(--color-ink-muted);
	}

	.ok {
		color: var(--color-ink);
	}

	.problem {
		color: var(--color-danger);
	}

	.advanced {
		display: grid;
		gap: var(--space-3);
		width: 100%;
	}

	summary {
		min-height: var(--tap-min);
		padding: var(--space-2) 0;
		font-weight: var(--weight-medium);
		cursor: pointer;
	}

	.note {
		color: var(--color-ink-muted);
		font-size: var(--text-s);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.themes {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		border: none;
	}

	legend {
		margin-bottom: var(--space-2);
		font-weight: var(--weight-medium);
	}

	code {
		font-size: var(--text-s);
	}

	.storage {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}

	h3 {
		font-size: var(--text-m);
		font-weight: var(--weight-bold);
	}
</style>
