/**
 * Momentum CMS Admin Tailwind Preset
 *
 * Shared Tailwind configuration for the admin UI.
 * Apps should extend this preset to get consistent styling.
 *
 * Usage in app tailwind.config.js:
 * ```js
 * const adminPreset = require('@momentum-cms/admin/tailwind.preset');
 * module.exports = {
 *   presets: [adminPreset],
 *   content: ['./src/**\/*.{html,ts}', '../../libs/admin/src/**\/*.{html,ts}'],
 * };
 * ```
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: 'class', // Enable dark mode via .dark class on <html>
	theme: {
		extend: {
			colors: {
				// Semantic colors using CSS variables (defined in theme.css)
				// Using HSL values without the hsl() wrapper for alpha support
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

				// Sidebar-specific colors
				sidebar: {
					DEFAULT: 'hsl(var(--mcms-sidebar) / <alpha-value>)',
					foreground: 'hsl(var(--mcms-sidebar-foreground) / <alpha-value>)',
					primary: 'hsl(var(--mcms-sidebar-primary) / <alpha-value>)',
					'primary-foreground': 'hsl(var(--mcms-sidebar-primary-foreground) / <alpha-value>)',
					accent: 'hsl(var(--mcms-sidebar-accent) / <alpha-value>)',
					'accent-foreground': 'hsl(var(--mcms-sidebar-accent-foreground) / <alpha-value>)',
					border: 'hsl(var(--mcms-sidebar-border) / <alpha-value>)',
					ring: 'hsl(var(--mcms-sidebar-ring) / <alpha-value>)',
				},
			},

			borderRadius: {
				lg: 'var(--mcms-radius)',
				md: 'calc(var(--mcms-radius) - 2px)',
				sm: 'calc(var(--mcms-radius) - 4px)',
			},

			// Custom animations for UI components
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' },
				},
				'fade-in': {
					from: { opacity: '0' },
					to: { opacity: '1' },
				},
				'fade-out': {
					from: { opacity: '1' },
					to: { opacity: '0' },
				},
				'slide-in-from-right': {
					from: { transform: 'translateX(100%)' },
					to: { transform: 'translateX(0)' },
				},
				'slide-out-to-right': {
					from: { transform: 'translateX(0)' },
					to: { transform: 'translateX(100%)' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.2s ease-out',
				'fade-out': 'fade-out 0.2s ease-out',
				'slide-in-from-right': 'slide-in-from-right 0.3s ease-out',
				'slide-out-to-right': 'slide-out-to-right 0.3s ease-out',
			},
		},
	},
	plugins: [],
};
