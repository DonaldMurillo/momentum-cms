/**
 * Theme Editor Store
 *
 * Signal-based state management with undo/redo and localStorage persistence.
 */

import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { ThemeEditorState, ThemeStyleProps } from './theme-editor.types';
import { COMMON_STYLE_KEYS, isValidThemeEditorState } from './theme-editor.types';
import { defaultThemeState, defaultLightStyles, defaultDarkStyles } from './theme-defaults';
import { getPreset, THEME_PRESETS } from './presets';

const STORAGE_KEY = 'mcms-theme-editor';
const MAX_HISTORY = 30;
const DEBOUNCE_MS = 500;

@Injectable()
export class ThemeEditorStore {
	private readonly doc = inject(DOCUMENT);
	private readonly storage = this.doc.defaultView?.localStorage ?? null;

	/** Current editor state */
	readonly state = signal<ThemeEditorState>(this.loadFromStorage() ?? defaultThemeState);

	/** Undo stack */
	private readonly historyStack = signal<ThemeEditorState[]>([]);
	private readonly futureStack = signal<ThemeEditorState[]>([]);
	private lastChangeTime = 0;

	/** Derived signals */
	readonly currentMode = computed(() => this.state().currentMode);
	readonly currentStyles = computed(() => {
		const s = this.state();
		return s.currentMode === 'dark' ? s.styles.dark : s.styles.light;
	});
	readonly presetId = computed(() => this.state().preset ?? 'default');
	readonly canUndo = computed(() => this.historyStack().length > 0);
	readonly canRedo = computed(() => this.futureStack().length > 0);
	readonly presets = THEME_PRESETS;

	constructor() {
		// Persist to localStorage on state changes
		if (this.storage) {
			const storage = this.storage;
			effect(() => {
				const s = this.state();
				try {
					storage.setItem(STORAGE_KEY, JSON.stringify(s));
				} catch {
					// Storage quota exceeded — ignore
				}
			});
		}
	}

	/** Update a single style property in the current mode */
	setStyleProp(key: keyof ThemeStyleProps, value: string): void {
		const current = this.state();
		const mode = current.currentMode;

		const updatedModeStyles = { ...current.styles[mode], [key]: value };

		// If it's a common key, apply to both modes
		const styles = COMMON_STYLE_KEYS.includes(key)
			? {
					light: { ...current.styles.light, [key]: value },
					dark: { ...current.styles.dark, [key]: value },
				}
			: {
					...current.styles,
					[mode]: updatedModeStyles,
				};

		this.pushState({ ...current, styles, preset: undefined });
	}

	/** Apply a named preset */
	applyPreset(presetId: string): void {
		const preset = getPreset(presetId);
		if (!preset) return;

		const current = this.state();
		this.pushHistory(current);

		const light: ThemeStyleProps = { ...defaultLightStyles, ...preset.styles.light };
		const dark: ThemeStyleProps = { ...defaultDarkStyles, ...preset.styles.dark };

		this.state.set({
			...current,
			styles: { light, dark },
			preset: presetId,
		});
		this.futureStack.set([]);
	}

	/** Toggle between light and dark mode (no history push) */
	toggleMode(): void {
		const current = this.state();
		this.state.set({
			...current,
			currentMode: current.currentMode === 'light' ? 'dark' : 'light',
		});
	}

	/** Set mode explicitly (no history push) */
	setMode(mode: 'light' | 'dark'): void {
		const current = this.state();
		if (current.currentMode === mode) return;
		this.state.set({ ...current, currentMode: mode });
	}

	/** Undo last change */
	undo(): void {
		const history = this.historyStack();
		if (history.length === 0) return;

		const current = this.state();
		const previous = history[history.length - 1];

		this.historyStack.set(history.slice(0, -1));
		this.futureStack.set([{ ...current, currentMode: current.currentMode }, ...this.futureStack()]);
		this.state.set({ ...previous, currentMode: current.currentMode });
	}

	/** Redo last undone change */
	redo(): void {
		const future = this.futureStack();
		if (future.length === 0) return;

		const current = this.state();
		const next = future[0];

		this.futureStack.set(future.slice(1));
		const history = this.historyStack();
		const updated = [...history, { ...current, currentMode: current.currentMode }];
		if (updated.length > MAX_HISTORY) updated.shift();
		this.historyStack.set(updated);

		this.state.set({ ...next, currentMode: current.currentMode });
	}

	/** Reset to current preset defaults */
	reset(): void {
		const presetId = this.state().preset ?? 'default';
		this.applyPreset(presetId);
	}

	/** Push a new state with history tracking */
	private pushState(newState: ThemeEditorState): void {
		const current = this.state();
		const now = Date.now();

		// Debounce rapid changes — overwrite last history entry if within threshold
		if (now - this.lastChangeTime >= DEBOUNCE_MS) {
			this.pushHistory(current);
		}

		// Always clear redo stack on any new change (debounced or not)
		this.futureStack.set([]);

		this.lastChangeTime = now;
		this.state.set(newState);
	}

	private pushHistory(entry: ThemeEditorState): void {
		const history = [...this.historyStack(), entry];
		if (history.length > MAX_HISTORY) history.shift();
		this.historyStack.set(history);
	}

	private loadFromStorage(): ThemeEditorState | null {
		if (!this.storage) return null;
		try {
			const raw = this.storage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const parsed: unknown = JSON.parse(raw);
			if (!isValidThemeEditorState(parsed)) return null;
			return parsed;
		} catch {
			return null;
		}
	}
}
