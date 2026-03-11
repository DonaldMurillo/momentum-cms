import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeEditorStore } from './theme-editor.store';
import { defaultLightStyles, defaultDarkStyles, defaultThemeState } from './theme-defaults';
import { THEME_PRESETS } from './presets';
import { COMMON_STYLE_KEYS } from './theme-editor.types';
import { isValidThemeEditorState } from './theme-editor.types';

/** Get a preset by ID or fail the test */
function requirePreset(id: string) {
	const preset = THEME_PRESETS.find((p) => p.id === id);
	if (!preset) throw new Error(`Preset '${id}' not found in THEME_PRESETS`);
	return preset;
}

describe('ThemeEditorStore', () => {
	let store: ThemeEditorStore;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [ThemeEditorStore],
		});
		store = TestBed.inject(ThemeEditorStore);
	});

	describe('initial state', () => {
		it('starts in light mode with default styles', () => {
			expect(store.currentMode()).toBe('light');
			expect(store.currentStyles()).toEqual(defaultLightStyles);
		});

		it('has no undo/redo available', () => {
			expect(store.canUndo()).toBe(false);
			expect(store.canRedo()).toBe(false);
		});

		it('has default preset selected', () => {
			expect(store.presetId()).toBe('default');
		});
	});

	describe('setStyleProp — color properties', () => {
		it('updates primary color in light mode', () => {
			store.setStyleProp('primary', 'oklch(0.6 0.2 250)');
			expect(store.currentStyles().primary).toBe('oklch(0.6 0.2 250)');
		});

		it('updates primary color only in current mode', () => {
			store.setStyleProp('primary', 'oklch(0.6 0.2 250)');
			// Light mode updated
			expect(store.state().styles.light.primary).toBe('oklch(0.6 0.2 250)');
			// Dark mode untouched
			expect(store.state().styles.dark.primary).toBe(defaultDarkStyles.primary);
		});

		it('updates background color', () => {
			store.setStyleProp('background', 'oklch(0.98 0.01 200)');
			expect(store.currentStyles().background).toBe('oklch(0.98 0.01 200)');
		});

		it('updates destructive color', () => {
			store.setStyleProp('destructive', 'oklch(0.5 0.3 30)');
			expect(store.currentStyles().destructive).toBe('oklch(0.5 0.3 30)');
		});

		it('updates border color', () => {
			store.setStyleProp('border', 'oklch(0.85 0 0)');
			expect(store.currentStyles().border).toBe('oklch(0.85 0 0)');
		});

		it('updates ring color', () => {
			store.setStyleProp('ring', 'oklch(0.5 0.15 260)');
			expect(store.currentStyles().ring).toBe('oklch(0.5 0.15 260)');
		});

		it('updates dark mode color when in dark mode', () => {
			store.setMode('dark');
			store.setStyleProp('primary', 'oklch(0.8 0.15 300)');
			expect(store.state().styles.dark.primary).toBe('oklch(0.8 0.15 300)');
			// Light mode untouched
			expect(store.state().styles.light.primary).toBe(defaultLightStyles.primary);
		});

		it('clears preset on color change', () => {
			expect(store.presetId()).toBe('default');
			store.setStyleProp('primary', 'oklch(0.6 0.2 250)');
			expect(store.state().preset).toBeUndefined();
		});
	});

	describe('setStyleProp — common properties (both modes)', () => {
		for (const key of COMMON_STYLE_KEYS) {
			it(`applies ${key} to both light and dark`, () => {
				const testValue = key === 'radius' ? '1rem' : key.includes('shadow') ? '5px' : '0.05em';
				store.setStyleProp(key, testValue);
				expect(store.state().styles.light[key]).toBe(testValue);
				expect(store.state().styles.dark[key]).toBe(testValue);
			});
		}
	});

	describe('setStyleProp — typography', () => {
		it('updates font-sans in both modes', () => {
			store.setStyleProp('font-sans', "'Inter', sans-serif");
			expect(store.state().styles.light['font-sans']).toBe("'Inter', sans-serif");
			expect(store.state().styles.dark['font-sans']).toBe("'Inter', sans-serif");
		});

		it('updates font-serif in both modes', () => {
			store.setStyleProp('font-serif', "'Merriweather', serif");
			expect(store.state().styles.light['font-serif']).toBe("'Merriweather', serif");
			expect(store.state().styles.dark['font-serif']).toBe("'Merriweather', serif");
		});

		it('updates font-mono in both modes', () => {
			store.setStyleProp('font-mono', "'Fira Code', monospace");
			expect(store.state().styles.light['font-mono']).toBe("'Fira Code', monospace");
			expect(store.state().styles.dark['font-mono']).toBe("'Fira Code', monospace");
		});
	});

	describe('setStyleProp — visual controls', () => {
		it('updates radius in both modes', () => {
			store.setStyleProp('radius', '1rem');
			expect(store.state().styles.light.radius).toBe('1rem');
			expect(store.state().styles.dark.radius).toBe('1rem');
		});

		it('updates shadow-opacity in both modes', () => {
			store.setStyleProp('shadow-opacity', '0.25');
			expect(store.state().styles.light['shadow-opacity']).toBe('0.25');
			expect(store.state().styles.dark['shadow-opacity']).toBe('0.25');
		});

		it('updates shadow-blur in both modes', () => {
			store.setStyleProp('shadow-blur', '10px');
			expect(store.state().styles.light['shadow-blur']).toBe('10px');
			expect(store.state().styles.dark['shadow-blur']).toBe('10px');
		});

		it('updates letter-spacing in both modes', () => {
			store.setStyleProp('letter-spacing', '0.05em');
			expect(store.state().styles.light['letter-spacing']).toBe('0.05em');
			expect(store.state().styles.dark['letter-spacing']).toBe('0.05em');
		});

		it('updates shadow-color in both modes (regression: must be a common key)', () => {
			store.setStyleProp('shadow-color', 'oklch(0.3 0 0)');
			expect(store.state().styles.light['shadow-color']).toBe('oklch(0.3 0 0)');
			expect(store.state().styles.dark['shadow-color']).toBe('oklch(0.3 0 0)');
		});
	});

	describe('applyPreset', () => {
		it('applies ocean preset colors', () => {
			const oceanPreset = requirePreset('ocean');
			store.applyPreset('ocean');

			expect(store.presetId()).toBe('ocean');
			expect(store.currentStyles().primary).toBe(oceanPreset.styles.light.primary);
		});

		it('applies warm preset with radius override', () => {
			const warmPreset = requirePreset('warm');
			store.applyPreset('warm');

			expect(store.currentStyles().primary).toBe(warmPreset.styles.light.primary);
			expect(store.currentStyles().radius).toBe(warmPreset.styles.light.radius);
		});

		it('applies minimal preset with zero radius and shadow', () => {
			const minimalPreset = requirePreset('minimal');
			store.applyPreset('minimal');

			expect(store.currentStyles().radius).toBe(minimalPreset.styles.light.radius);
			expect(store.currentStyles()['shadow-opacity']).toBe(
				minimalPreset.styles.light['shadow-opacity'],
			);
			expect(store.currentStyles()['shadow-blur']).toBe(minimalPreset.styles.light['shadow-blur']);
		});

		it('applies neon preset with custom background', () => {
			const neonPreset = requirePreset('neon');
			store.applyPreset('neon');

			expect(store.currentStyles().background).toBe(neonPreset.styles.light.background);
			expect(store.currentStyles().primary).toBe(neonPreset.styles.light.primary);
		});

		it('fills in unspecified keys from defaults', () => {
			store.applyPreset('ocean');
			// Ocean doesn't override font-sans — should be default
			expect(store.currentStyles()['font-sans']).toBe(defaultLightStyles['font-sans']);
		});

		it('also applies dark mode styles', () => {
			const oceanPreset = requirePreset('ocean');
			store.applyPreset('ocean');
			store.setMode('dark');

			expect(store.currentStyles().primary).toBe(oceanPreset.styles.dark.primary);
		});

		it('ignores nonexistent preset without corrupting state', () => {
			const before = store.state();
			store.applyPreset('nonexistent-preset-id');
			expect(store.state()).toEqual(before);
		});
	});

	describe('mode toggle', () => {
		it('switches to dark mode', () => {
			store.setMode('dark');
			expect(store.currentMode()).toBe('dark');
			expect(store.currentStyles()).toEqual(defaultDarkStyles);
		});

		it('switches back to light mode', () => {
			store.setMode('dark');
			store.setMode('light');
			expect(store.currentMode()).toBe('light');
			expect(store.currentStyles()).toEqual(defaultLightStyles);
		});

		it('toggleMode flips modes', () => {
			store.toggleMode();
			expect(store.currentMode()).toBe('dark');
			store.toggleMode();
			expect(store.currentMode()).toBe('light');
		});
	});

	describe('undo/redo', () => {
		it('can undo a color change', () => {
			const originalPrimary = store.currentStyles().primary;
			store.setStyleProp('primary', 'oklch(0.6 0.2 250)');

			// Wait for debounce
			store.undo();
			expect(store.currentStyles().primary).toBe(originalPrimary);
		});

		it('can redo after undo', () => {
			store.setStyleProp('primary', 'oklch(0.6 0.2 250)');
			store.undo();
			store.redo();
			expect(store.currentStyles().primary).toBe('oklch(0.6 0.2 250)');
		});

		it('can undo a preset change', () => {
			const originalPrimary = store.currentStyles().primary;
			store.applyPreset('ocean');

			store.undo();
			expect(store.currentStyles().primary).toBe(originalPrimary);
			expect(store.presetId()).toBe('default');
		});
	});

	describe('reset', () => {
		it('resets to default preset when no preset is active', () => {
			// Modify a color (clears preset to undefined)
			store.setStyleProp('primary', 'oklch(0.1 0 0)');
			expect(store.currentStyles().primary).toBe('oklch(0.1 0 0)');
			expect(store.state().preset).toBeUndefined();

			// Reset falls back to 'default' when preset is undefined
			store.reset();
			expect(store.currentStyles().primary).toBe(defaultLightStyles.primary);
		});

		it('resets to active preset when preset is still set', () => {
			store.applyPreset('ocean');
			const oceanPrimary = store.currentStyles().primary;

			// Reset without modifying (preset stays as 'ocean')
			store.reset();
			expect(store.currentStyles().primary).toBe(oceanPrimary);
		});
	});

	describe('undo/redo clears redo stack on new changes', () => {
		it('clears redo stack even during debounced rapid changes', async () => {
			// Make a change outside debounce window
			store.setStyleProp('primary', 'oklch(0.1 0.1 100)');

			// Wait for debounce to expire
			await new Promise((r) => setTimeout(r, 600));

			// Make another change (outside debounce)
			store.setStyleProp('primary', 'oklch(0.2 0.2 200)');

			// Undo — should now have redo available
			store.undo();
			expect(store.canRedo()).toBe(true);

			// Make a rapid change within debounce window — redo should be cleared
			store.setStyleProp('primary', 'oklch(0.3 0.3 300)');
			expect(store.canRedo()).toBe(false);
		});
	});

	describe('undo/redo edge cases', () => {
		it('undo when empty is a safe no-op', () => {
			const before = store.state();
			store.undo();
			expect(store.state()).toEqual(before);
			expect(store.canUndo()).toBe(false);
		});

		it('redo when empty is a safe no-op', () => {
			const before = store.state();
			store.redo();
			expect(store.state()).toEqual(before);
			expect(store.canRedo()).toBe(false);
		});
	});

	describe('isValidThemeEditorState', () => {
		it('accepts a valid default state', () => {
			expect(isValidThemeEditorState(defaultThemeState)).toBe(true);
		});

		it('rejects null', () => {
			expect(isValidThemeEditorState(null)).toBe(false);
		});

		it('rejects undefined', () => {
			expect(isValidThemeEditorState(undefined)).toBe(false);
		});

		it('rejects a plain string', () => {
			expect(isValidThemeEditorState('hello')).toBe(false);
		});

		it('rejects an empty object', () => {
			expect(isValidThemeEditorState({})).toBe(false);
		});

		it('rejects missing styles property', () => {
			expect(isValidThemeEditorState({ currentMode: 'light' })).toBe(false);
		});

		it('rejects invalid currentMode', () => {
			expect(
				isValidThemeEditorState({
					styles: { light: defaultLightStyles, dark: defaultDarkStyles },
					currentMode: 'invalid',
				}),
			).toBe(false);
		});

		it('rejects missing light styles', () => {
			expect(
				isValidThemeEditorState({
					styles: { dark: defaultDarkStyles },
					currentMode: 'light',
				}),
			).toBe(false);
		});

		it('rejects missing dark styles', () => {
			expect(
				isValidThemeEditorState({
					styles: { light: defaultLightStyles },
					currentMode: 'light',
				}),
			).toBe(false);
		});

		it('rejects light styles with missing required keys', () => {
			const { primary: _, ...incomplete } = defaultLightStyles;
			expect(
				isValidThemeEditorState({
					styles: { light: incomplete, dark: defaultDarkStyles },
					currentMode: 'light',
				}),
			).toBe(false);
		});

		it('rejects styles where a value is not a string', () => {
			expect(
				isValidThemeEditorState({
					styles: {
						light: { ...defaultLightStyles, primary: 42 },
						dark: defaultDarkStyles,
					},
					currentMode: 'light',
				}),
			).toBe(false);
		});

		it('accepts state with optional preset string', () => {
			expect(
				isValidThemeEditorState({
					styles: { light: defaultLightStyles, dark: defaultDarkStyles },
					currentMode: 'dark',
					preset: 'ocean',
				}),
			).toBe(true);
		});

		it('rejects state where preset is not a string', () => {
			expect(
				isValidThemeEditorState({
					styles: { light: defaultLightStyles, dark: defaultDarkStyles },
					currentMode: 'light',
					preset: 123,
				}),
			).toBe(false);
		});
	});
});
