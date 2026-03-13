/**
 * Default Theme Values
 *
 * OKLCH color values for light and dark modes.
 * Based on the same neutral palette as tweakcn/shadcn defaults.
 */

import type { ThemeStyleProps, ThemeEditorState } from './theme-editor.types';

const DEFAULT_FONT_SANS =
	"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

const DEFAULT_FONT_SERIF = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

const DEFAULT_FONT_MONO =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const defaultLightStyles: ThemeStyleProps = {
	background: 'oklch(1 0 0)',
	foreground: 'oklch(0.145 0 0)',
	card: 'oklch(1 0 0)',
	'card-foreground': 'oklch(0.145 0 0)',
	popover: 'oklch(1 0 0)',
	'popover-foreground': 'oklch(0.145 0 0)',
	primary: 'oklch(0.205 0 0)',
	'primary-foreground': 'oklch(0.985 0 0)',
	secondary: 'oklch(0.97 0 0)',
	'secondary-foreground': 'oklch(0.205 0 0)',
	muted: 'oklch(0.97 0 0)',
	'muted-foreground': 'oklch(0.556 0 0)',
	accent: 'oklch(0.97 0 0)',
	'accent-foreground': 'oklch(0.205 0 0)',
	destructive: 'oklch(0.577 0.245 27.325)',
	'destructive-foreground': 'oklch(1 0 0)',
	border: 'oklch(0.922 0 0)',
	input: 'oklch(0.922 0 0)',
	ring: 'oklch(0.708 0 0)',
	'font-sans': DEFAULT_FONT_SANS,
	'font-serif': DEFAULT_FONT_SERIF,
	'font-mono': DEFAULT_FONT_MONO,
	radius: '0.625rem',
	'shadow-color': 'oklch(0 0 0)',
	'shadow-opacity': '0.1',
	'shadow-blur': '3px',
	'shadow-spread': '0px',
	'shadow-offset-x': '0',
	'shadow-offset-y': '1px',
	'letter-spacing': '0em',
};

export const defaultDarkStyles: ThemeStyleProps = {
	...defaultLightStyles,
	background: 'oklch(0.145 0 0)',
	foreground: 'oklch(0.985 0 0)',
	card: 'oklch(0.205 0 0)',
	'card-foreground': 'oklch(0.985 0 0)',
	popover: 'oklch(0.269 0 0)',
	'popover-foreground': 'oklch(0.985 0 0)',
	primary: 'oklch(0.922 0 0)',
	'primary-foreground': 'oklch(0.205 0 0)',
	secondary: 'oklch(0.269 0 0)',
	'secondary-foreground': 'oklch(0.985 0 0)',
	muted: 'oklch(0.269 0 0)',
	'muted-foreground': 'oklch(0.708 0 0)',
	accent: 'oklch(0.371 0 0)',
	'accent-foreground': 'oklch(0.985 0 0)',
	destructive: 'oklch(0.704 0.191 22.216)',
	'destructive-foreground': 'oklch(0.985 0 0)',
	border: 'oklch(0.275 0 0)',
	input: 'oklch(0.325 0 0)',
	ring: 'oklch(0.556 0 0)',
	'shadow-color': 'oklch(0 0 0)',
};

export const defaultThemeState: ThemeEditorState = {
	styles: {
		light: defaultLightStyles,
		dark: defaultDarkStyles,
	},
	currentMode: 'light',
	preset: 'default',
};
