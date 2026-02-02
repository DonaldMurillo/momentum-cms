const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/**
 * UI Library Tailwind Configuration
 *
 * This config is used for building the UI library.
 * It mirrors the semantic color system from the admin preset.
 * Apps consuming this library should use the admin preset for full theming.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: 'class',
	content: [
		join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
		...createGlobPatternsForDependencies(__dirname),
	],
	theme: {
		extend: {
			colors: {
				// Semantic colors using CSS variables (defined by consuming apps)
				background: 'hsl(var(--mcms-background) / <alpha-value>)',
				foreground: 'hsl(var(--mcms-foreground) / <alpha-value>)',

				card: {
					DEFAULT: 'hsl(var(--mcms-card) / <alpha-value>)',
					foreground: 'hsl(var(--mcms-card-foreground) / <alpha-value>)',
				},

				primary: {
					DEFAULT: 'hsl(var(--mcms-primary) / <alpha-value>)',
					foreground: 'hsl(var(--mcms-primary-foreground) / <alpha-value>)',
				},

				secondary: {
					DEFAULT: 'hsl(var(--mcms-secondary) / <alpha-value>)',
					foreground: 'hsl(var(--mcms-secondary-foreground) / <alpha-value>)',
				},

				muted: {
					DEFAULT: 'hsl(var(--mcms-muted) / <alpha-value>)',
					foreground: 'hsl(var(--mcms-muted-foreground) / <alpha-value>)',
				},

				accent: {
					DEFAULT: 'hsl(var(--mcms-accent) / <alpha-value>)',
					foreground: 'hsl(var(--mcms-accent-foreground) / <alpha-value>)',
				},

				destructive: {
					DEFAULT: 'hsl(var(--mcms-destructive) / <alpha-value>)',
					foreground: 'hsl(var(--mcms-destructive-foreground) / <alpha-value>)',
				},

				border: 'hsl(var(--mcms-border) / <alpha-value>)',
				input: 'hsl(var(--mcms-input) / <alpha-value>)',
				ring: 'hsl(var(--mcms-ring) / <alpha-value>)',
			},

			borderRadius: {
				lg: 'var(--mcms-radius)',
				md: 'calc(var(--mcms-radius) - 2px)',
				sm: 'calc(var(--mcms-radius) - 4px)',
			},
		},
	},
	plugins: [],
};
