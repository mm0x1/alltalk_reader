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
	import {
		applyTextSize,
		readTextSize,
		TEXT_SIZES,
		textSizeLabel,
		type TextSize
	} from '#lib/design/text-size.js';
	import { applyTheme, readTheme, THEMES, type Theme } from '#lib/design/theme.js';
	import {
		AHEAD_MAX,
		AHEAD_MIN,
		DEFAULT_BUFFER,
		readBuffer,
		writeBuffer,
		type BufferSettings
	} from '#lib/reader/buffer.js';
	import { LANGUAGES, NARRATOR_AVAILABLE, type VoiceSettings } from '#lib/settings.js';
	import { PASSAGE_MAX_CHARS, PASSAGE_MIN_CHARS, speechSeconds } from '#lib/text/passages.js';
	import type { EngineSummary, ServerStatus } from '#lib/status.js';
	import { session } from '#lib/reader/session.svelte.js';
	import Badge from '#lib/ui/Badge.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Confirm from '#lib/ui/Confirm.svelte';
	import Radio from '#lib/ui/Radio.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import { toasts } from '#lib/ui/toasts.svelte.js';
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
	let textSize = $state<TextSize>('medium');
	let buffer = $state<BufferSettings>(DEFAULT_BUFFER);
	let canSave = $state(false);
	let storage = $state<StorageUse | null>(null);
	let clearOpen = $state(false);

	function megabytes(bytes: number | null): string {
		return bytes === null ? '?' : `${Math.round(bytes / 1024 / 1024).toLocaleString()} MB`;
	}

	async function refreshStorage() {
		storage = await storageUse();
	}

	const engine = $derived(status?.alltalk.engine ?? null);
	/** The model AllTalk is loading, while it does. */
	let loadingModel = $state<string | null>(null);
	let previewing = $state<string | null>(null);

	/** Shows AllTalk's engine as it reports it after a change. */
	function showEngine(next: EngineSummary) {
		if (status) status = { ...status, alltalk: { ...status.alltalk, engine: next } };
	}

	async function chooseModel(model: string) {
		if (!engine || model === engine.model) return;
		loadingModel = model;
		try {
			showEngine(await api.loadModel(model));
			toasts.show(`AllTalk is using ${model}.`);
		} catch (error) {
			const reason = error instanceof Error ? ` ${error.message}` : '';
			toasts.show(`The model wasn\u2019t changed.${reason}`, { problem: true });
		} finally {
			loadingModel = null;
		}
	}

	async function setMode(modes: { lowVram?: boolean; deepSpeed?: boolean }) {
		try {
			showEngine(await api.setModes(modes));
		} catch (error) {
			const reason = error instanceof Error ? ` ${error.message}` : '';
			toasts.show(`AllTalk didn\u2019t change.${reason}`, { problem: true });
			// Show AllTalk's real state again.
			api
				.status()
				.then((result) => (status = result))
				.catch(() => undefined);
		}
	}

	/** Plays a short sample of a voice; the book pauses meanwhile. */
	async function preview(name: string, rvcVoice: string, rvcPitch: number) {
		previewing = name;
		// iOS only lets audio start inside the tap, and the sample takes seconds to make: start a
		// silent clip now, so the same element may play the sample when it arrives.
		const audio = new Audio('/silence.wav');
		audio.play().catch(() => undefined);
		try {
			session.player?.pause();
			const url = URL.createObjectURL(await api.previewVoice(name, rvcVoice, rvcPitch));
			audio.src = url;
			const done = () => URL.revokeObjectURL(url);
			audio.addEventListener('ended', done, { once: true });
			audio.addEventListener('error', done, { once: true });
			await audio.play();
		} catch (error) {
			const reason = error instanceof Error ? ` ${error.message}` : '';
			toasts.show(`The voice couldn\u2019t be previewed.${reason}`, { problem: true });
		} finally {
			previewing = null;
		}
	}
	const voices = $derived(status?.alltalk.voices ?? []);
	const rvcVoices = $derived(status?.alltalk.rvcVoices ?? []);

	onMount(() => {
		theme = readTheme();
		textSize = readTextSize();
		buffer = readBuffer();
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
			<p class="state"><Spinner /> Checking AllTalk</p>
		{/if}
		{#if engine && engine.models.length > 1}
			<Select
				id="model"
				label="Model"
				value={loadingModel ?? engine.model ?? ''}
				disabled={loadingModel !== null}
				onchange={(event) => chooseModel(event.currentTarget.value)}
			>
				{#each engine.models as model (model)}
					<option value={model}>{model}</option>
				{/each}
			</Select>
			{#if loadingModel}
				<p class="state" role="status"><Spinner /> AllTalk is loading {loadingModel}</p>
			{:else}
				<p class="note">Applies at once, for every device. Audio made with each model is kept.</p>
			{/if}
		{/if}
		{#if engine && (engine.lowVram.capable || (engine.deepSpeed.capable && engine.deepSpeed.available))}
			<details class="advanced">
				<summary>Advanced</summary>
				{#if engine.lowVram.capable}
					<Checkbox
						id="low-vram"
						label="Low VRAM mode"
						hint="Keeps the model in system memory and moves it to the graphics card only to speak. For cards with little memory; each passage starts a little later."
						checked={engine.lowVram.enabled}
						onchange={(event) => setMode({ lowVram: event.currentTarget.checked })}
					/>
				{/if}
				{#if engine.deepSpeed.capable && engine.deepSpeed.available}
					<Checkbox
						id="deepspeed"
						label="DeepSpeed"
						hint="Faster speech on NVIDIA cards with DeepSpeed installed."
						checked={engine.deepSpeed.enabled}
						onchange={(event) => setMode({ deepSpeed: event.currentTarget.checked })}
					/>
				{/if}
			</details>
		{/if}
		<p class="note">
			If AllTalk is busy preparing passages nobody will hear, this tells it to stop.
		</p>
		<Button
			variant="outline"
			onclick={async () => {
				try {
					await api.stopSpeech();
					toasts.show('AllTalk stopped preparing audio.');
				} catch (error) {
					const reason = error instanceof Error ? ` ${error.message}` : '';
					toasts.show(`AllTalk couldn\u2019t be stopped.${reason}`, { problem: true });
				}
			}}>Stop generating audio</Button
		>
	</section>

	<form onsubmit={save} aria-labelledby="voice-heading">
		<h2 id="voice-heading">Voice</h2>

		<Select id="voice" label="Voice" bind:value={voice.voice}>
			<option value="">AllTalk&rsquo;s default</option>
			{#each voices as name (name)}
				<option value={name}>{voiceLabel(name)}</option>
			{/each}
		</Select>
		{@render hear(voice.voice, voice.rvcVoice, voice.rvcPitch)}

		<Select id="language" label="Language" bind:value={voice.language}>
			{#each LANGUAGES as code (code)}
				<option value={code}>{LANGUAGE_NAMES[code] ?? code}</option>
			{/each}
		</Select>

		<Slider
			id="passage-length"
			label="Passage length"
			min={PASSAGE_MIN_CHARS}
			max={PASSAGE_MAX_CHARS}
			step="5"
			bind:value={voice.passageChars}
		>
			{#snippet after()}{`Up to ${voice.passageChars} characters, about ${speechSeconds(voice.passageChars)} s of speech`}{/snippet}
		</Slider>
		<p class="note">
			How much AllTalk reads at a time. Shorter starts sooner and keeps waits short; longer sounds
			smoother. Short lines of dialogue are read together, long paragraphs in parts.
		</p>

		{#if NARRATOR_AVAILABLE}
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
				{@render hear(voice.narratorVoice, voice.rvcNarratorVoice, voice.rvcNarratorPitch)}
				<Select id="unquoted" label="Text outside quotes is read by" bind:value={voice.unquotedIs}>
					<option value="narrator">the narrator</option>
					<option value="character">the main voice</option>
					<option value="silent">nobody (skip it)</option>
				</Select>
			{/if}
		{/if}

		{#if engine?.capabilities.temperature || engine?.capabilities.repetitionPenalty || engine?.capabilities.pitch || rvcVoices.length > 1}
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
				{#if engine?.capabilities.pitch}
					<Slider id="pitch" label="Pitch" min="-10" max="10" step="1" bind:value={voice.pitch}>
						{#snippet after()}{voice.pitch === 0 ? 'Engine default' : voice.pitch}{/snippet}
					</Slider>
				{/if}
				{#if engine?.capabilities.repetitionPenalty}
					<Slider
						id="repetition-penalty"
						label="Fewer repeated words (repetition penalty)"
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
					{#if NARRATOR_AVAILABLE && voice.narratorEnabled}
						<Select
							id="rvc-narrator"
							label="Narrator RVC voice"
							bind:value={voice.rvcNarratorVoice}
						>
							{#each rvcVoices as name (name)}
								<option value={name}>{name === 'Disabled' ? 'Off' : name}</option>
							{/each}
						</Select>
						{#if voice.rvcNarratorVoice !== 'Disabled'}
							<Slider
								id="rvc-narrator-pitch"
								label={`Narrator RVC pitch (${voice.rvcNarratorPitch})`}
								min="-24"
								max="24"
								step="1"
								bind:value={voice.rvcNarratorPitch}
							/>
						{/if}
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
		<fieldset class="themes">
			<legend>Text size</legend>
			{#each TEXT_SIZES as option (option)}
				<Radio
					name="text-size"
					value={option}
					label={textSizeLabel(option)}
					checked={textSize === option}
					onchange={() => {
						textSize = option;
						applyTextSize(option);
					}}
				/>
			{/each}
			<p class="sample" aria-hidden="true">It is a truth universally acknowledged&hellip;</p>
		</fieldset>
		<div class="buffer">
			<h3>Preparing audio</h3>
			<p class="note">
				Passages are made ready while you listen. More helps a slow AllTalk keep up; fewer wastes
				less work when you skip around.
			</p>
			<Slider
				id="buffer-ahead"
				label="Prepare ahead"
				min={AHEAD_MIN}
				max={AHEAD_MAX}
				step="1"
				bind:value={() => buffer.ahead, (ahead) => (buffer = writeBuffer({ ...buffer, ahead }))}
			>
				{#snippet after()}{`${buffer.ahead} ${buffer.ahead === 1 ? 'passage' : 'passages'}, about ${speechSeconds(buffer.ahead * voice.passageChars)} s`}{/snippet}
			</Slider>
			<Slider
				id="buffer-before"
				label="Before playing, have ready"
				min="0"
				max={buffer.ahead}
				step="1"
				bind:value={() => buffer.before, (before) => (buffer = writeBuffer({ ...buffer, before }))}
			>
				{#snippet after()}
					{buffer.before === 0
						? 'Start at once'
						: `${buffer.before} more ${buffer.before === 1 ? 'passage' : 'passages'}`}
				{/snippet}
			</Slider>
			<p class="note">
				Waiting for more at the start, and whenever the voice catches up, means one longer pause
				instead of a stop before every passage.
			</p>
		</div>
		<div class="storage">
			<h3>Offline listening</h3>
			{#if canSave}
				<p class="note">
					Save chapters from a book&rsquo;s Contents to listen without a connection. Readhouse uses
					{megabytes(storage?.usedBytes ?? null)} on this device{#if storage?.persisted}, kept safe
						from automatic clean-up{/if}.
				</p>
				<Button variant="danger" onclick={() => (clearOpen = true)}>Remove offline copies</Button>
				<Confirm
					bind:open={clearOpen}
					title="Remove offline copies?"
					confirmLabel="Remove them"
					onconfirm={async () => {
						await clearOfflineData();
						await refreshStorage();
					}}
				>
					Saved chapters and audio leave this device. Your books and places stay in the library.
				</Confirm>
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

<!-- A short sample of a voice, as AllTalk would say it (with its RVC voice, if any). -->
{#snippet hear(name: string, rvcVoice: string, rvcPitch: number)}
	{#if name}
		<Button
			variant="outline"
			icon="play"
			disabled={previewing !== null}
			onclick={() => preview(name, rvcVoice, rvcPitch)}
		>
			{previewing === name ? 'Preparing\u2026' : 'Hear this voice'}
		</Button>
	{/if}
{/snippet}

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

	.buffer {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.sample {
		margin: var(--space-2) 0 var(--space-4);
		font-family: var(--font-reading);
		font-size: var(--text-reading);
		line-height: var(--leading-reading);
	}

	legend {
		margin-bottom: var(--space-2);
		padding: 0;
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
