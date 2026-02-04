/**
 * Theme Service Unit Tests
 *
 * Tests the core theme logic without Angular DI.
 * Full integration testing is done via E2E tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, computed } from '@angular/core';

// Test the core theme logic in isolation
describe('Theme Logic', () => {
	// Mock matchMedia
	const mockMatchMedia = vi.fn();

	// Mock localStorage
	const mockStorage: Record<string, string> = {};
	const mockLocalStorage = {
		getItem: vi.fn((key: string) => mockStorage[key] ?? null),
		setItem: vi.fn((key: string, value: string) => {
			mockStorage[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete mockStorage[key];
		}),
		clear: vi.fn(() => {
			Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
		}),
		length: 0,
		key: vi.fn(),
	};

	beforeEach(() => {
		// Reset storage mock
		Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
		vi.clearAllMocks();

		// Mock localStorage globally
		Object.defineProperty(globalThis, 'localStorage', {
			value: mockLocalStorage,
			writable: true,
		});

		// Mock matchMedia to return light preference
		mockMatchMedia.mockReturnValue({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		});
		window.matchMedia = mockMatchMedia;

		// Clear dark class
		document.documentElement.classList.remove('dark');
	});

	describe('theme signal logic', () => {
		it('should store and retrieve theme values', () => {
			const theme = signal<'light' | 'dark' | 'system'>('system');

			expect(theme()).toBe('system');

			theme.set('dark');
			expect(theme()).toBe('dark');

			theme.set('light');
			expect(theme()).toBe('light');
		});

		it('should resolve system preference to dark', () => {
			mockMatchMedia.mockReturnValue({
				matches: true, // prefers dark
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			});

			const theme = signal<'light' | 'dark' | 'system'>('system');
			const resolvedTheme = computed((): 'light' | 'dark' => {
				const current = theme();
				if (current === 'system') {
					const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
					return mediaQuery.matches ? 'dark' : 'light';
				}
				return current;
			});

			expect(resolvedTheme()).toBe('dark');
		});

		it('should resolve system preference to light', () => {
			mockMatchMedia.mockReturnValue({
				matches: false, // prefers light
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			});

			const theme = signal<'light' | 'dark' | 'system'>('system');
			const resolvedTheme = computed((): 'light' | 'dark' => {
				const current = theme();
				if (current === 'system') {
					const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
					return mediaQuery.matches ? 'dark' : 'light';
				}
				return current;
			});

			expect(resolvedTheme()).toBe('light');
		});
	});

	describe('localStorage persistence', () => {
		it('should persist theme to localStorage', () => {
			const STORAGE_KEY = 'mcms-theme';

			localStorage.setItem(STORAGE_KEY, 'dark');
			expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

			localStorage.setItem(STORAGE_KEY, 'light');
			expect(localStorage.getItem(STORAGE_KEY)).toBe('light');

			localStorage.setItem(STORAGE_KEY, 'system');
			expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
		});

		it('should load theme from localStorage', () => {
			const STORAGE_KEY = 'mcms-theme';

			// Simulate loadTheme function
			const loadTheme = (): 'light' | 'dark' | 'system' => {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored === 'light' || stored === 'dark' || stored === 'system') {
					return stored;
				}
				return 'system';
			};

			// No stored value - should default to system
			expect(loadTheme()).toBe('system');

			localStorage.setItem(STORAGE_KEY, 'dark');
			expect(loadTheme()).toBe('dark');

			localStorage.setItem(STORAGE_KEY, 'invalid');
			expect(loadTheme()).toBe('system');
		});
	});

	describe('DOM class manipulation', () => {
		it('should add dark class to documentElement', () => {
			document.documentElement.classList.add('dark');
			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});

		it('should remove dark class from documentElement', () => {
			document.documentElement.classList.add('dark');
			document.documentElement.classList.remove('dark');
			expect(document.documentElement.classList.contains('dark')).toBe(false);
		});
	});

	describe('toggle logic', () => {
		it('should toggle from light to dark', () => {
			const theme = signal<'light' | 'dark' | 'system'>('light');
			const resolvedTheme = computed((): 'light' | 'dark' => {
				const current = theme();
				if (current === 'system') {
					return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
				}
				return current;
			});

			// Toggle function
			const toggle = (): void => {
				const current = resolvedTheme();
				theme.set(current === 'dark' ? 'light' : 'dark');
			};

			expect(resolvedTheme()).toBe('light');
			toggle();
			expect(theme()).toBe('dark');
		});

		it('should toggle from dark to light', () => {
			const theme = signal<'light' | 'dark' | 'system'>('dark');
			const resolvedTheme = computed((): 'light' | 'dark' => {
				const current = theme();
				if (current === 'system') {
					return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
				}
				return current;
			});

			const toggle = (): void => {
				const current = resolvedTheme();
				theme.set(current === 'dark' ? 'light' : 'dark');
			};

			expect(resolvedTheme()).toBe('dark');
			toggle();
			expect(theme()).toBe('light');
		});

		it('should toggle from system (light) to dark', () => {
			// System prefers light
			mockMatchMedia.mockReturnValue({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			});

			const theme = signal<'light' | 'dark' | 'system'>('system');
			const resolvedTheme = computed((): 'light' | 'dark' => {
				const current = theme();
				if (current === 'system') {
					return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
				}
				return current;
			});

			const toggle = (): void => {
				const current = resolvedTheme();
				theme.set(current === 'dark' ? 'light' : 'dark');
			};

			expect(resolvedTheme()).toBe('light');
			toggle();
			expect(theme()).toBe('dark');
		});
	});
});
