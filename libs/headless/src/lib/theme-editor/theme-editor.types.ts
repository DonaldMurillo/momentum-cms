/**
 * Theme Editor Type System
 *
 * Flat key-value theme properties matching CSS custom property names.
 * Uses OKLCH color format for perceptually uniform color manipulation.
 * Mirrors the approach used by tweakcn for shadcn/ui theming.
 */

/** All CSS custom property names that make up a theme */
export interface ThemeStyleProps {
	// Base colors
	background: string;
	foreground: string;

	// Semantic color pairs
	primary: string;
	'primary-foreground': string;
	secondary: string;
	'secondary-foreground': string;
	accent: string;
	'accent-foreground': string;
	destructive: string;
	'destructive-foreground': string;
	muted: string;
	'muted-foreground': string;

	// Surface colors
	card: string;
	'card-foreground': string;
	popover: string;
	'popover-foreground': string;

	// Utility colors
	border: string;
	input: string;
	ring: string;

	// Typography
	'font-sans': string;
	'font-serif': string;
	'font-mono': string;

	// Border radius
	radius: string;

	// Shadows
	'shadow-color': string;
	'shadow-opacity': string;
	'shadow-blur': string;
	'shadow-spread': string;
	'shadow-offset-x': string;
	'shadow-offset-y': string;

	// Spacing & typography tuning
	'letter-spacing': string;
}

/** Light + dark mode theme configuration */
export interface ThemeConfig {
	light: ThemeStyleProps;
	dark: ThemeStyleProps;
}

/** Current state of the theme editor */
export interface ThemeEditorState {
	styles: ThemeConfig;
	currentMode: 'light' | 'dark';
	preset?: string;
}

/** A named theme preset */
export interface ThemePreset {
	id: string;
	name: string;
	description: string;
	styles: { light: Partial<ThemeStyleProps>; dark: Partial<ThemeStyleProps> };
}

/** Keys shared between light and dark modes (only set once) */
export const COMMON_STYLE_KEYS: (keyof ThemeStyleProps)[] = [
	'font-sans',
	'font-serif',
	'font-mono',
	'radius',
	'shadow-opacity',
	'shadow-blur',
	'shadow-spread',
	'shadow-offset-x',
	'shadow-offset-y',
	'letter-spacing',
];

/** Required keys that every ThemeStyleProps must have */
const REQUIRED_STYLE_KEYS: (keyof ThemeStyleProps)[] = [
	'background',
	'foreground',
	'primary',
	'primary-foreground',
	'secondary',
	'secondary-foreground',
	'accent',
	'accent-foreground',
	'destructive',
	'destructive-foreground',
	'muted',
	'muted-foreground',
	'card',
	'card-foreground',
	'popover',
	'popover-foreground',
	'border',
	'input',
	'ring',
	'font-sans',
	'font-serif',
	'font-mono',
	'radius',
	'shadow-color',
	'shadow-opacity',
	'shadow-blur',
	'shadow-spread',
	'shadow-offset-x',
	'shadow-offset-y',
	'letter-spacing',
];

/** Runtime validation guard for data loaded from untrusted sources (e.g. localStorage) */
export function isValidThemeEditorState(value: unknown): value is ThemeEditorState {
	if (value == null || typeof value !== 'object') return false;

	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type guard requires narrowing unknown
	const obj = value as Record<string, unknown>;

	// Validate currentMode
	if (obj['currentMode'] !== 'light' && obj['currentMode'] !== 'dark') return false;

	// Validate optional preset
	if (obj['preset'] !== undefined && typeof obj['preset'] !== 'string') return false;

	// Validate styles
	if (obj['styles'] == null || typeof obj['styles'] !== 'object') return false;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type guard requires narrowing unknown
	const styles = obj['styles'] as Record<string, unknown>;

	// Validate light and dark sub-objects
	for (const mode of ['light', 'dark'] as const) {
		const modeStyles = styles[mode];
		if (modeStyles == null || typeof modeStyles !== 'object') return false;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- type guard requires narrowing unknown
		const modeObj = modeStyles as Record<string, unknown>;
		for (const key of REQUIRED_STYLE_KEYS) {
			if (typeof modeObj[key] !== 'string') return false;
		}
	}

	return true;
}

/** Color property keys (everything except typography, radius, shadows, spacing) */
export const COLOR_KEYS: (keyof ThemeStyleProps)[] = [
	'background',
	'foreground',
	'primary',
	'primary-foreground',
	'secondary',
	'secondary-foreground',
	'accent',
	'accent-foreground',
	'destructive',
	'destructive-foreground',
	'muted',
	'muted-foreground',
	'card',
	'card-foreground',
	'popover',
	'popover-foreground',
	'border',
	'input',
	'ring',
];

/** Grouped color pairs for the editor UI */
export const COLOR_PAIRS: {
	label: string;
	bg: keyof ThemeStyleProps;
	fg?: keyof ThemeStyleProps;
}[] = [
	{ label: 'Background', bg: 'background', fg: 'foreground' },
	{ label: 'Primary', bg: 'primary', fg: 'primary-foreground' },
	{ label: 'Secondary', bg: 'secondary', fg: 'secondary-foreground' },
	{ label: 'Accent', bg: 'accent', fg: 'accent-foreground' },
	{ label: 'Destructive', bg: 'destructive', fg: 'destructive-foreground' },
	{ label: 'Muted', bg: 'muted', fg: 'muted-foreground' },
	{ label: 'Card', bg: 'card', fg: 'card-foreground' },
	{ label: 'Popover', bg: 'popover', fg: 'popover-foreground' },
	{ label: 'Border', bg: 'border' },
	{ label: 'Input', bg: 'input' },
	{ label: 'Ring', bg: 'ring' },
];
