<script lang="ts">
	/**
	 * Waiting: a printer's flower (four petals, from old title pages) turning slowly beside the
	 * words that say what is happening. Decoration only; the words carry the meaning. Still when
	 * the device asks for reduced motion.
	 */
</script>

<svg
	class="spinner"
	viewBox="0 0 24 24"
	aria-hidden="true"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linejoin="round"
>
	<path
		d="M12 12C9.6 8.6 10.4 4.4 12 2.4c1.6 2 2.4 6.2 0 9.6zM12 12c3.4-2.4 7.6-1.6 9.6 0-2 1.6-6.2 2.4-9.6 0zM12 12c2.4 3.4 1.6 7.6 0 9.6-1.6-2-2.4-6.2 0-9.6zM12 12c-3.4 2.4-7.6 1.6-9.6 0 2-1.6 6.2-2.4 9.6 0z"
	/>
</svg>

<style>
	.spinner {
		flex: none;
		width: 1.25em;
		height: 1.25em;
		vertical-align: -0.25em;
		animation: turn var(--duration-turn) linear infinite;
	}

	@keyframes turn {
		to {
			transform: rotate(1turn);
		}
	}
</style>
