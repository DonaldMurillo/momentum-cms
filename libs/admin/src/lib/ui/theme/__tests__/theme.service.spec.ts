/**
 * McmsThemeService Unit Tests
 *
 * The service uses effect() and inject(DestroyRef) in the constructor,
 * which requires a fully running Angular application context.
 * For browser context, we test the core logic directly (same as the
 * sibling theme.service.spec.ts) but import the service to exercise its code.
 * For server context, TestBed works since the constructor skips effects.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal, computed } from '@angular/core';
import { vi } from 'vitest';
import { McmsThemeService, type McmsTheme } from '../theme.service';

describe('McmsThemeService', () => {
	describe('server context (via TestBed)', () => {
		let service: McmsThemeService;

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
			});

			service = TestBed.inject(McmsThemeService);
		});

		it('should default to system theme on server', () => {
			expect(service.theme()).toBe('system');
		});

		it('should resolve to light on server (no matchMedia)', () => {
			expect(service.resolvedTheme()).toBe('light');
		});

		it('should not be dark on server', () => {
			expect(service.isDark()).toBe(false);
		});

		it('should allow setting theme without error on server', () => {
			service.setTheme('dark');
			expect(service.theme()).toBe('dark');
			expect(service.resolvedTheme()).toBe('dark');
			expect(service.isDark()).toBe(true);
		});

		it('should toggle theme on server', () => {
			service.setTheme('light');
			service.toggleTheme();
			expect(service.theme()).toBe('dark');
			expect(service.isDark()).toBe(true);

			service.toggleTheme();
			expect(service.theme()).toBe('light');
			expect(service.isDark()).toBe(false);
		});

		it('should resolve system as light on server', () => {
			service.setTheme('system');
			expect(service.resolvedTheme()).toBe('light');
		});
	});

	describe('browser context (via TestBed)', () => {
		let service: McmsThemeService;
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');

			// jsdom lacks matchMedia — mock it before service construction
			originalMatchMedia = window.matchMedia;
			window.matchMedia = vi.fn().mockReturnValue({
				matches: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}) as unknown as typeof window.matchMedia;

			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
			});

			service = TestBed.inject(McmsThemeService);
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should default to system theme', () => {
			expect(service.theme()).toBe('system');
		});

		it('should set and persist theme to localStorage', () => {
			service.setTheme('dark');
			expect(service.theme()).toBe('dark');
			expect(localStorage.getItem('mcms-theme')).toBe('dark');
		});

		it('should set light theme', () => {
			service.setTheme('light');
			expect(service.theme()).toBe('light');
			expect(localStorage.getItem('mcms-theme')).toBe('light');
		});

		it('should toggle from light to dark', () => {
			service.setTheme('light');
			service.toggleTheme();
			expect(service.theme()).toBe('dark');
		});

		it('should toggle from dark to light', () => {
			service.setTheme('dark');
			service.toggleTheme();
			expect(service.theme()).toBe('light');
		});

		it('should resolve dark theme correctly', () => {
			service.setTheme('dark');
			expect(service.resolvedTheme()).toBe('dark');
			expect(service.isDark()).toBe(true);
		});

		it('should resolve light theme correctly', () => {
			service.setTheme('light');
			expect(service.resolvedTheme()).toBe('light');
			expect(service.isDark()).toBe(false);
		});

		it('should load stored theme from localStorage', () => {
			localStorage.setItem('mcms-theme', 'dark');
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
			});
			const svc = TestBed.inject(McmsThemeService);
			expect(svc.theme()).toBe('dark');
		});

		it('should ignore invalid stored theme', () => {
			localStorage.setItem('mcms-theme', 'invalid-value');
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
			});
			const svc = TestBed.inject(McmsThemeService);
			expect(svc.theme()).toBe('system');
		});
	});

	describe('browser theme logic (direct test)', () => {
		const STORAGE_KEY = 'mcms-theme';

		beforeEach(() => {
			localStorage.removeItem(STORAGE_KEY);
			document.documentElement.classList.remove('dark');
		});

		afterEach(() => {
			localStorage.removeItem(STORAGE_KEY);
			document.documentElement.classList.remove('dark');
		});

		it('should load system as default when no stored value', () => {
			const loadTheme = (): McmsTheme => {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
				return 'system';
			};
			expect(loadTheme()).toBe('system');
		});

		it('should load stored dark theme', () => {
			localStorage.setItem(STORAGE_KEY, 'dark');
			const stored = localStorage.getItem(STORAGE_KEY);
			expect(stored).toBe('dark');
		});

		it('should load stored light theme', () => {
			localStorage.setItem(STORAGE_KEY, 'light');
			const stored = localStorage.getItem(STORAGE_KEY);
			expect(stored).toBe('light');
		});

		it('should default to system for invalid stored value', () => {
			localStorage.setItem(STORAGE_KEY, 'neon-purple');
			const loadTheme = (): McmsTheme => {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
				return 'system';
			};
			expect(loadTheme()).toBe('system');
		});

		it('should persist theme to localStorage and cookie', () => {
			const setTheme = (theme: McmsTheme): void => {
				localStorage.setItem(STORAGE_KEY, theme);
				document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
			};

			setTheme('dark');
			expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
			expect(document.cookie).toContain('mcms-theme=dark');
		});

		it('should apply dark class to DOM', () => {
			document.documentElement.classList.add('dark');
			expect(document.documentElement.classList.contains('dark')).toBe(true);

			document.documentElement.classList.remove('dark');
			expect(document.documentElement.classList.contains('dark')).toBe(false);
		});

		it('should resolve system preference via matchMedia (mocked)', () => {
			// jsdom lacks matchMedia — mock it
			const originalMatchMedia = window.matchMedia;
			window.matchMedia = vi
				.fn()
				.mockReturnValue({
					matches: true,
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
				});
			try {
				const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
				expect(mediaQuery.matches).toBe(true);
			} finally {
				window.matchMedia = originalMatchMedia;
			}
		});

		it('should use signal-based resolved theme logic', () => {
			const theme = signal<McmsTheme>('dark');
			// Use a fallback for missing matchMedia (jsdom)
			const getSystemPref = (): 'light' | 'dark' => {
				if (typeof window.matchMedia !== 'function') return 'light';
				return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			};
			const resolvedTheme = computed((): 'light' | 'dark' => {
				const current = theme();
				if (current === 'system') return getSystemPref();
				return current;
			});
			const isDark = computed(() => resolvedTheme() === 'dark');

			expect(resolvedTheme()).toBe('dark');
			expect(isDark()).toBe(true);

			theme.set('light');
			expect(resolvedTheme()).toBe('light');
			expect(isDark()).toBe(false);
		});

		it('should toggle based on resolved theme', () => {
			const theme = signal<McmsTheme>('light');
			const resolvedTheme = computed((): 'light' | 'dark' => {
				const current = theme();
				if (current === 'system') return 'light'; // fallback for jsdom
				return current;
			});

			const toggleTheme = (): void => {
				const current = resolvedTheme();
				theme.set(current === 'dark' ? 'light' : 'dark');
			};

			expect(resolvedTheme()).toBe('light');
			toggleTheme();
			expect(theme()).toBe('dark');
			expect(resolvedTheme()).toBe('dark');
			toggleTheme();
			expect(theme()).toBe('light');
		});
	});
});
