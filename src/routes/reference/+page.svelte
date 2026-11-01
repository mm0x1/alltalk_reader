<script lang="ts">
	import tokensCss from '#lib/design/tokens.css?raw';
	import Badge from '#lib/ui/Badge.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FilePicker from '#lib/ui/FilePicker.svelte';
	import Icon, { type IconName } from '#lib/ui/Icon.svelte';
	import ListRow from '#lib/ui/ListRow.svelte';
	import Progress from '#lib/ui/Progress.svelte';
	import Radio from '#lib/ui/Radio.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Slider from '#lib/ui/Slider.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import ToastSlug from '#lib/ui/ToastSlug.svelte';

	/*
	 * Every token and component on one sheet, in the theme the device shows (Settings switches
	 * it; the visual tests photograph all three). Token names come from tokens.css itself, so the
	 * sheet can't fall behind it. Sheets and dialogs are photographed where they are used.
	 */
	const names = [...new Set([...tokensCss.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]))];
	const group = (prefix: string) => names.filter((name) => name.startsWith(prefix));

	const colors = group('--color-');
	const sizes = group('--text-');
	const spaces = group('--space-');
	const radii = group('--radius-');
	const shadows = group('--shadow-').filter((name) => name !== '--shadow-frame-mask');

	const ICONS: IconName[] = [
		'play',
		'pause',
		'previous',
		'next',
		'contents',
		'settings',
		'add',
		'close',
		'back',
		'trash',
		'book',
		'follow',
		'save',
		'saved',
		'sleep'
	];

	let text = $state('');
	let checked = $state(true);
	let slider = $state(0.7);
	const noop = () => {};
</script>

<svelte:head>
	<title>Reference &middot; Readhouse</title>
</svelte:head>

<main class="reference">
	<h1>Readhouse reference</h1>
	<p class="lede">Every token and component, in the theme this device shows.</p>

	<section aria-labelledby="colors">
		<h2 id="colors">Colour</h2>
		<ul class="swatches">
			{#each colors as name (name)}
				<li>
					<span class="swatch" style:background={`var(${name})`}></span>
					<code>{name.slice(8)}</code>
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="type">
		<h2 id="type">Type</h2>
		<ul class="type">
			{#each sizes as name (name)}
				<li>
					<code>{name.slice(7)}</code>
					<span style:font-size={`var(${name})`}>Readhouse reads aloud</span>
				</li>
			{/each}
		</ul>
		<p class="specimen">
			Regular, <em>italic</em>, <strong>bold</strong>, <span class="caps">Small capitals</span>,
			<span class="label">Spaced label</span>, figures 1234567890.
		</p>
	</section>

	<section aria-labelledby="space">
		<h2 id="space">Space, radius, depth</h2>
		<ul class="spaces">
			{#each spaces as name (name)}
				<li><code>{name.slice(8)}</code><span class="bar" style:width={`var(${name})`}></span></li>
			{/each}
		</ul>
		<ul class="tiles">
			{#each radii as name (name)}
				<li>
					<span class="tile" style:border-radius={`var(${name})`}></span><code>{name.slice(2)}</code
					>
				</li>
			{/each}
			{#each shadows as name (name)}
				<li>
					<span class="tile" style:box-shadow={`var(${name})`}></span><code>{name.slice(2)}</code>
				</li>
			{/each}
			<li><span class="tile double"></span><code>border-double</code></li>
		</ul>
	</section>

	<section aria-labelledby="buttons">
		<h2 id="buttons">Buttons and icons</h2>
		<div class="row">
			<Button variant="primary">Primary</Button>
			<Button variant="quiet">Quiet</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="danger">Danger</Button>
			<Button variant="danger-solid">Danger, filled</Button>
			<Button variant="outline" disabled>Disabled</Button>
			<Button variant="outline" icon="add">With icon</Button>
			<Button icon="settings" aria-label="Icon only" />
			<Button href="#buttons" variant="outline">A link</Button>
			<span>In a sentence, <Button variant="text">Reset</Button>.</span>
		</div>
		<ul class="icons">
			{#each ICONS as name (name)}
				<li><Icon {name} /><code>{name}</code></li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="fields">
		<h2 id="fields">Fields</h2>
		<div class="stack">
			<TextField id="ref-text" label="Title" placeholder="Title (optional)" bind:value={text} />
			<TextField id="ref-hint" label="With a hint" hint="A hint under the field." value="" />
			<TextField id="ref-area" label="Text" multiline rows={3} placeholder="Paste here" />
			<Select id="ref-select" label="Voice" value="b">
				<option value="a">AllTalk&rsquo;s default</option>
				<option value="b">female_01</option>
			</Select>
			<Checkbox
				id="ref-check"
				label="Narrator"
				hint="A second voice reads outside quotes."
				bind:checked
			>
				{#snippet badge()}<Badge>Experimental</Badge>{/snippet}
			</Checkbox>
			<Checkbox id="ref-check-off" label="Unchecked" />
			<fieldset class="radios">
				<legend>Theme</legend>
				<Radio name="ref-theme" value="light" label="Light" checked />
				<Radio name="ref-theme" value="dark" label="Dark" />
				<Radio name="ref-theme" value="sepia" label="Sepia" />
			</fieldset>
			<Slider id="ref-slider" label="Temperature" min="0.1" max="1" step="0.05" bind:value={slider}>
				{#snippet after()}{slider.toFixed(2)}{/snippet}
			</Slider>
			<FilePicker label="Choose a file" onpick={noop} />
		</div>
	</section>

	<section aria-labelledby="lists">
		<h2 id="lists">Lists and progress</h2>
		<ol class="list">
			<li><ListRow title="Chapter 1" meta="2,336 words" current /></li>
			<li><ListRow title="The Assembly at Meryton" meta="1,168 words" /></li>
			<li>
				<ListRow
					title="A chapter title long enough to wrap onto a second line on a phone"
					meta="3 of 23"
				/>
			</li>
		</ol>
		<div class="stack">
			<Progress value={0} max={0} label="Waiting to start" />
			<Progress value={7} max={23} label="Saving, part way" />
			<Progress value={23} max={23} label="Saved" />
		</div>
	</section>

	<section aria-labelledby="feedback">
		<h2 id="feedback">Waiting, notices, empty</h2>
		<p class="waiting"><Spinner /> Preparing the next passage</p>
		<div class="stack">
			<ToastSlug
				toast={{
					id: -1,
					message: 'Chapter III is saved for listening offline.',
					problem: false,
					action: null
				}}
			/>
			<ToastSlug
				toast={{
					id: -2,
					message: 'Chapter IV wasn’t saved. AllTalk isn’t answering.',
					problem: true,
					action: { label: 'Try again', run: noop }
				}}
			/>
		</div>
		<EmptyState title="Nothing on the shelf yet.">
			Add an EPUB or a text file, or paste a chapter from AO3.
			{#snippet action()}<Button variant="outline" icon="add">Add a book</Button>{/snippet}
		</EmptyState>
	</section>

	<section aria-labelledby="ornament">
		<h2 id="ornament">Ornament</h2>
		<div class="band" aria-hidden="true"><span>IV.</span></div>
	</section>
</main>

<style>
	/* A long sheet photographed whole: the fixed page frame would break the capture. */
	:global(body:has(.reference) .frame) {
		display: none;
	}

	.reference {
		display: grid;
		gap: var(--space-7);
		max-width: var(--content-max);
		margin: 0 auto;
		padding: calc(var(--space-7) + var(--safe-top)) var(--space-5)
			calc(var(--space-8) + var(--safe-bottom));
	}

	h1 {
		font-size: var(--text-2xl);
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-display);
	}

	.lede {
		margin-top: calc(var(--space-6) * -1);
		color: var(--color-ink-muted);
	}

	section {
		display: grid;
		gap: var(--space-4);
		padding-top: var(--space-4);
		border-top: var(--border-thin) solid var(--color-rule);
	}

	h2 {
		font-size: var(--text-xl);
		font-weight: var(--weight-regular);
		font-style: italic;
	}

	code {
		color: var(--color-ink-muted);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		overflow-wrap: anywhere;
	}

	.swatches,
	.tiles,
	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--space-4);
	}

	.swatches li,
	.tiles li,
	.icons li {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}

	.swatch {
		width: 100%;
		height: var(--space-7);
		border: var(--border-thin) solid var(--color-rule-soft);
	}

	.type li,
	.spaces li {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		align-items: baseline;
		gap: var(--space-3);
		padding-block: var(--space-1);
	}

	.specimen {
		font-size: var(--text-reading);
		line-height: var(--leading-reading);
	}

	.caps {
		font-variant-caps: all-small-caps;
		letter-spacing: var(--tracking-display);
	}

	.label {
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.spaces li {
		align-items: center;
	}

	.bar {
		height: var(--space-3);
		background: var(--color-ink);
	}

	.tile {
		width: var(--space-8);
		height: var(--space-7);
		border: var(--border-thin) solid var(--color-rule);
		background: var(--color-paper-raised);
	}

	.tile.double {
		border: var(--border-double) double var(--color-rule);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.icons li {
		grid-auto-flow: column;
		align-items: center;
		justify-content: start;
		font-size: var(--text-l);
	}

	.stack {
		display: grid;
		gap: var(--space-4);
		max-width: var(--measure);
	}

	.radios {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		border: none;
	}

	.radios legend {
		margin-bottom: var(--space-1);
		font-size: var(--text-xs);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
	}

	.list {
		max-width: var(--measure);
	}

	.waiting {
		color: var(--color-ink-muted);
		font-style: italic;
	}

	.band {
		display: grid;
		place-items: center;
		max-width: var(--measure);
		height: var(--band-height);
		background-image: var(--dither-band);
		background-size: auto 100%;
		image-rendering: pixelated;
	}

	.band span {
		padding: 0 var(--space-2);
		border: var(--border-double) double var(--color-rule);
		background: var(--color-paper);
		font-size: var(--text-xl);
	}
</style>
