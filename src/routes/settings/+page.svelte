<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { api } from '#lib/client/api.js';
	import { applyTheme, readTheme, THEMES, type Theme } from '#lib/design/theme.js';
	import { LANGUAGES, type VoiceSettings } from '#lib/settings.js';
	import type { ServerStatus } from '#lib/status.js';
	import Button from '#lib/ui/Button.svelte';
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

	const engine = $derived(status?.alltalk.engine ?? null);
	const voices = $derived(status?.alltalk.voices ?? []);
	const rvcVoices = $derived(status?.alltalk.rvcVoices ?? []);

	onMount(() => {
		theme = readTheme();
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

		<label class="field">
			<span>Voice</span>
			<select bind:value={voice.voice}>
				<option value="">AllTalk&rsquo;s default</option>
				{#each voices as name (name)}
					<option value={name}>{voiceLabel(name)}</option>
				{/each}
			</select>
		</label>

		<label class="field">
			<span>Language</span>
			<select bind:value={voice.language}>
				{#each LANGUAGES as code (code)}
					<option value={code}>{LANGUAGE_NAMES[code] ?? code}</option>
				{/each}
			</select>
		</label>

		<label class="check">
			<input type="checkbox" bind:checked={voice.narratorEnabled} />
			<span>
				<strong>Narrator</strong>
				<small>A second voice reads everything outside of quotes, so dialogue stands out.</small>
			</span>
		</label>

		{#if voice.narratorEnabled}
			<label class="field">
				<span>Narrator voice</span>
				<select bind:value={voice.narratorVoice}>
					<option value="">AllTalk&rsquo;s default</option>
					{#each voices as name (name)}
						<option value={name}>{voiceLabel(name)}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span>Text outside quotes is read by</span>
				<select bind:value={voice.unquotedIs}>
					<option value="narrator">the narrator</option>
					<option value="character">the main voice</option>
				</select>
			</label>
		{/if}

		{#if engine?.capabilities.temperature || engine?.capabilities.repetitionPenalty || rvcVoices.length > 1}
			<details class="advanced">
				<summary>Advanced</summary>
				{#if engine?.capabilities.temperature}
					<label class="field">
						<span>Expressiveness (temperature)</span>
						<input
							type="range"
							min="0.1"
							max="1"
							step="0.05"
							value={voice.temperature ?? 0.75}
							oninput={(event) => (voice.temperature = Number(event.currentTarget.value))}
						/>
						<small
							>{voice.temperature === null ? 'Engine default' : voice.temperature.toFixed(2)}
							<button type="button" class="link" onclick={() => (voice.temperature = null)}
								>Reset</button
							></small
						>
					</label>
				{/if}
				{#if engine?.capabilities.repetitionPenalty}
					<label class="field">
						<span>Repetition penalty</span>
						<input
							type="range"
							min="1"
							max="20"
							step="0.5"
							value={voice.repetitionPenalty ?? 10}
							oninput={(event) => (voice.repetitionPenalty = Number(event.currentTarget.value))}
						/>
						<small
							>{voice.repetitionPenalty === null
								? 'Engine default'
								: voice.repetitionPenalty.toFixed(1)}
							<button type="button" class="link" onclick={() => (voice.repetitionPenalty = null)}
								>Reset</button
							></small
						>
					</label>
				{/if}
				{#if rvcVoices.length > 1}
					<label class="field">
						<span>RVC voice</span>
						<select bind:value={voice.rvcVoice}>
							{#each rvcVoices as name (name)}
								<option value={name}>{name === 'Disabled' ? 'Off' : name}</option>
							{/each}
						</select>
					</label>
					{#if voice.rvcVoice !== 'Disabled'}
						<label class="field">
							<span>RVC pitch ({voice.rvcPitch})</span>
							<input type="range" min="-24" max="24" step="1" bind:value={voice.rvcPitch} />
						</label>
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
				<label class="choice">
					<input
						type="radio"
						name="theme"
						value={option}
						checked={theme === option}
						onchange={() => {
							theme = option;
							applyTheme(option);
						}}
					/>
					<span
						>{option === 'system'
							? 'Match device'
							: option[0].toUpperCase() + option.slice(1)}</span
					>
				</label>
			{/each}
		</fieldset>
		{#if data.locked}
			<Button
				variant="outline"
				onclick={async () => {
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
		padding: calc(var(--space-2) + var(--safe-top)) var(--space-2) var(--space-2);
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
		padding: var(--space-2) var(--space-4) calc(var(--player-height) + var(--space-7));
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

	.field {
		display: grid;
		gap: var(--space-1);
		width: 100%;
	}

	.field > span {
		font-weight: var(--weight-medium);
	}

	select {
		min-height: var(--tap-min);
		padding: 0 var(--space-3);
		border: var(--border-thin) solid var(--color-rule);
		border-radius: var(--radius-s);
		background: var(--color-paper-raised);
		font-size: var(--text-m);
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--color-accent);
	}

	.check,
	.choice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		min-height: var(--tap-min);
		cursor: pointer;
	}

	.check input,
	.choice input {
		width: 1.25rem;
		height: 1.25rem;
		margin-top: var(--space-1);
		accent-color: var(--color-accent);
	}

	.check span {
		display: grid;
	}

	small {
		color: var(--color-ink-muted);
		font-size: var(--text-s);
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

	.link {
		margin-left: var(--space-2);
		padding: 0;
		border: none;
		background: none;
		color: var(--color-accent);
		text-decoration: underline;
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
</style>
