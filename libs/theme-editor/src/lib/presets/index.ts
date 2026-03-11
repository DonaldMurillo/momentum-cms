/**
 * Built-in Theme Presets
 *
 * Each preset provides partial overrides for light and dark modes.
 * Missing keys fall back to the default theme values.
 */

import type { ThemePreset } from '../theme-editor.types';

export const THEME_PRESETS: ThemePreset[] = [
	{
		id: 'default',
		name: 'Default',
		description: 'Neutral gray palette with clean lines',
		styles: { light: {}, dark: {} },
	},
	{
		id: 'ocean',
		name: 'Ocean',
		description: 'Blue and teal tones inspired by the sea',
		styles: {
			light: {
				primary: 'oklch(0.488 0.243 264.376)',
				'primary-foreground': 'oklch(0.985 0 0)',
				secondary: 'oklch(0.93 0.032 255)',
				'secondary-foreground': 'oklch(0.25 0.1 255)',
				accent: 'oklch(0.85 0.06 200)',
				'accent-foreground': 'oklch(0.25 0.08 200)',
				ring: 'oklch(0.488 0.243 264.376)',
			},
			dark: {
				primary: 'oklch(0.65 0.2 250)',
				'primary-foreground': 'oklch(0.15 0.02 250)',
				secondary: 'oklch(0.3 0.05 255)',
				'secondary-foreground': 'oklch(0.9 0.02 255)',
				accent: 'oklch(0.35 0.08 200)',
				'accent-foreground': 'oklch(0.9 0.03 200)',
				ring: 'oklch(0.65 0.2 250)',
			},
		},
	},
	{
		id: 'warm',
		name: 'Warm',
		description: 'Amber and orange tones with rounded corners',
		styles: {
			light: {
				primary: 'oklch(0.65 0.18 55)',
				'primary-foreground': 'oklch(0.99 0 0)',
				secondary: 'oklch(0.95 0.03 70)',
				'secondary-foreground': 'oklch(0.3 0.1 55)',
				accent: 'oklch(0.88 0.08 80)',
				'accent-foreground': 'oklch(0.3 0.08 60)',
				destructive: 'oklch(0.55 0.22 20)',
				'destructive-foreground': 'oklch(0.99 0 0)',
				ring: 'oklch(0.65 0.18 55)',
				radius: '0.75rem',
			},
			dark: {
				primary: 'oklch(0.75 0.15 55)',
				'primary-foreground': 'oklch(0.18 0.05 55)',
				secondary: 'oklch(0.28 0.04 70)',
				'secondary-foreground': 'oklch(0.92 0.03 70)',
				accent: 'oklch(0.35 0.08 80)',
				'accent-foreground': 'oklch(0.92 0.04 80)',
				ring: 'oklch(0.75 0.15 55)',
				radius: '0.75rem',
			},
		},
	},
	{
		id: 'minimal',
		name: 'Minimal',
		description: 'Monochrome, no shadows, sharp edges',
		styles: {
			light: {
				primary: 'oklch(0.145 0 0)',
				'primary-foreground': 'oklch(1 0 0)',
				secondary: 'oklch(0.95 0 0)',
				'secondary-foreground': 'oklch(0.145 0 0)',
				accent: 'oklch(0.93 0 0)',
				'accent-foreground': 'oklch(0.145 0 0)',
				muted: 'oklch(0.96 0 0)',
				'muted-foreground': 'oklch(0.45 0 0)',
				radius: '0rem',
				'shadow-opacity': '0',
				'shadow-blur': '0px',
			},
			dark: {
				primary: 'oklch(0.95 0 0)',
				'primary-foreground': 'oklch(0.1 0 0)',
				secondary: 'oklch(0.22 0 0)',
				'secondary-foreground': 'oklch(0.95 0 0)',
				accent: 'oklch(0.25 0 0)',
				'accent-foreground': 'oklch(0.95 0 0)',
				muted: 'oklch(0.2 0 0)',
				'muted-foreground': 'oklch(0.65 0 0)',
				radius: '0rem',
				'shadow-opacity': '0',
				'shadow-blur': '0px',
			},
		},
	},
	{
		id: 'neon',
		name: 'Neon',
		description: 'Dark background with vivid accent colors',
		styles: {
			light: {
				background: 'oklch(0.16 0.01 280)',
				foreground: 'oklch(0.95 0.01 280)',
				primary: 'oklch(0.75 0.3 320)',
				'primary-foreground': 'oklch(0.15 0.02 320)',
				secondary: 'oklch(0.25 0.04 280)',
				'secondary-foreground': 'oklch(0.9 0.02 280)',
				accent: 'oklch(0.7 0.25 180)',
				'accent-foreground': 'oklch(0.15 0.05 180)',
				muted: 'oklch(0.22 0.02 280)',
				'muted-foreground': 'oklch(0.65 0.02 280)',
				card: 'oklch(0.2 0.015 280)',
				'card-foreground': 'oklch(0.95 0.01 280)',
				popover: 'oklch(0.22 0.02 280)',
				'popover-foreground': 'oklch(0.95 0.01 280)',
				border: 'oklch(0.3 0.03 280)',
				input: 'oklch(0.28 0.03 280)',
				ring: 'oklch(0.75 0.3 320)',
				radius: '0.5rem',
			},
			dark: {
				background: 'oklch(0.12 0.015 280)',
				foreground: 'oklch(0.95 0.01 280)',
				primary: 'oklch(0.8 0.3 320)',
				'primary-foreground': 'oklch(0.12 0.02 320)',
				secondary: 'oklch(0.22 0.04 280)',
				'secondary-foreground': 'oklch(0.9 0.02 280)',
				accent: 'oklch(0.75 0.25 180)',
				'accent-foreground': 'oklch(0.12 0.05 180)',
				muted: 'oklch(0.2 0.02 280)',
				'muted-foreground': 'oklch(0.6 0.02 280)',
				card: 'oklch(0.17 0.015 280)',
				'card-foreground': 'oklch(0.95 0.01 280)',
				popover: 'oklch(0.19 0.02 280)',
				'popover-foreground': 'oklch(0.95 0.01 280)',
				border: 'oklch(0.27 0.03 280)',
				input: 'oklch(0.25 0.03 280)',
				ring: 'oklch(0.8 0.3 320)',
				radius: '0.5rem',
			},
		},
	},
];

/** Look up a preset by ID, returns undefined if not found */
export function getPreset(id: string): ThemePreset | undefined {
	return THEME_PRESETS.find((p) => p.id === id);
}
