/**
 * The design system, enforced: outside `src/lib/design/tokens.css`, colours, type, spacing,
 * shape, depth, layering and motion must come from tokens (`var(--...)`). A change to a token
 * then reaches the whole app, and no one-off values creep in.
 *
 * @type {import('stylelint').Config}
 */
export default {
	plugins: ['stylelint-declaration-strict-value'],
	overrides: [{ files: ['**/*.svelte'], customSyntax: 'postcss-html' }],
	ignoreFiles: ['build/**', '.svelte-kit/**', 'node_modules/**', 'src/lib/design/tokens.css'],
	rules: {
		'color-no-hex': true,
		'color-named': 'never',
		'function-disallowed-list': [
			'rgb',
			'rgba',
			'hsl',
			'hsla',
			'hwb',
			'lab',
			'lch',
			'oklab',
			'oklch',
			'color'
		],
		'declaration-no-important': true,
		'scale-unlimited/declaration-strict-value': [
			[
				'/color$/',
				'fill',
				'stroke',
				'background',
				'font-family',
				'font-size',
				'font-weight',
				'line-height',
				'letter-spacing',
				'/^margin/',
				'/^padding/',
				'gap',
				'row-gap',
				'column-gap',
				'/^inset/',
				'top',
				'right',
				'bottom',
				'left',
				'border-radius',
				'border-width',
				'outline-width',
				'outline-offset',
				'box-shadow',
				'z-index',
				'transition-duration',
				'animation-duration',
				'min-height',
				'min-width',
				'max-width',
				'width',
				'height'
			],
			{
				ignoreValues: [
					'0',
					'auto',
					'none',
					'inherit',
					'initial',
					'unset',
					'transparent',
					'currentColor',
					'currentcolor',
					'100%',
					'50%',
					'1',
					'1px',
					'2px',
					'1em',
					'1.25em',
					'max-content',
					'min-content',
					'fit-content',
					'100dvh',
					'normal'
				],
				expandShorthand: true,
				recurseLonghand: true,
				disableFix: true,
				message: 'Use a design token (var(--...)) for ${property}, not "${value}".'
			}
		]
	}
};
