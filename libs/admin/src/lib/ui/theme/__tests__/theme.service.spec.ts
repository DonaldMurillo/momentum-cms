/**
 * McmsThemeService Unit Tests
 *
 * The service uses effect() and inject(DestroyRef) in the constructor,
 * which requires a fully running Angular application context.
 * For browser context, we provide a mock document with a working
 * localStorage so the service can read/write theme state.
 * For server context, TestBed works since the constructor skips effects.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { vi } from 'vitest';
import { McmsThemeService } from '../theme.service';

/**
 * Creates a mock document that proxies to the real document but provides
 * a Map-backed localStorage on defaultView. This avoids reliance on jsdom's
 * localStorage which can become non-functional in Angular build pipelines.
 */
function createBrowserDocument(): { doc: Document; storage: Map<string, string> } {
	const storage = new Map<string, string>();
	const mockLocalStorage = {
		getItem: (key: string): string | null => storage.get(key) ?? null,
		setItem: (key: string, value: string): void => {
			storage.set(key, String(value));
		},
		removeItem: (key: string): void => {
			storage.delete(key);
		},
		clear: (): void => {
			storage.clear();
		},
		get length(): number {
			return storage.size;
		},
		key: (index: number): string | null => [...storage.keys()][index] ?? null,
	};

	const doc = new Proxy(document, {
		get(target, prop, receiver) {
			if (prop === 'defaultView') {
				return new Proxy(window, {
					get(wTarget, wProp, wReceiver) {
						if (wProp === 'localStorage') return mockLocalStorage;
						const val = Reflect.get(wTarget, wProp, wReceiver);
						return typeof val === 'function' ? val.bind(wTarget) : val;
					},
				});
			}
			const val = Reflect.get(target, prop, receiver);
			return typeof val === 'function' ? val.bind(target) : val;
		},
	});

	return { doc, storage };
}

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
		let mockStorage: Map<string, string>;
		let mockDoc: Document;

		beforeEach(() => {
			const { doc, storage } = createBrowserDocument();
			mockStorage = storage;
			mockDoc = doc;

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
				providers: [
					{ provide: PLATFORM_ID, useValue: 'browser' },
					{ provide: DOCUMENT, useValue: mockDoc },
				],
			});

			service = TestBed.inject(McmsThemeService);
		});

		afterEach(() => {
			mockStorage.clear();
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should default to system theme', () => {
			expect(service.theme()).toBe('system');
		});

		it('should set and persist theme to localStorage', () => {
			service.setTheme('dark');
			expect(service.theme()).toBe('dark');
			expect(mockStorage.get('mcms-theme')).toBe('dark');
		});

		it('should set light theme', () => {
			service.setTheme('light');
			expect(service.theme()).toBe('light');
			expect(mockStorage.get('mcms-theme')).toBe('light');
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
			mockStorage.set('mcms-theme', 'dark');
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [
					{ provide: PLATFORM_ID, useValue: 'browser' },
					{ provide: DOCUMENT, useValue: mockDoc },
				],
			});
			const svc = TestBed.inject(McmsThemeService);
			expect(svc.theme()).toBe('dark');
		});

		it('should ignore invalid stored theme', () => {
			mockStorage.set('mcms-theme', 'invalid-value');
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [
					{ provide: PLATFORM_ID, useValue: 'browser' },
					{ provide: DOCUMENT, useValue: mockDoc },
				],
			});
			const svc = TestBed.inject(McmsThemeService);
			expect(svc.theme()).toBe('system');
		});

		it('should apply dark class to DOM', () => {
			service.setTheme('dark');
			TestBed.flushEffects();
			expect(document.documentElement.classList.contains('dark')).toBe(true);

			service.setTheme('light');
			TestBed.flushEffects();
			expect(document.documentElement.classList.contains('dark')).toBe(false);
		});

		it('should resolve system preference via matchMedia', () => {
			// matchMedia mock returns { matches: false } (light preference)
			service.setTheme('system');
			expect(service.resolvedTheme()).toBe('light');
			expect(service.isDark()).toBe(false);
		});

		it('should use signal-based resolved theme correctly', () => {
			service.setTheme('dark');
			expect(service.resolvedTheme()).toBe('dark');
			expect(service.isDark()).toBe(true);

			service.setTheme('light');
			expect(service.resolvedTheme()).toBe('light');
			expect(service.isDark()).toBe(false);

			service.setTheme('system');
			// matchMedia mock returns matches: false (light)
			expect(service.resolvedTheme()).toBe('light');
		});

		it('should toggle based on resolved theme', () => {
			service.setTheme('light');
			expect(service.resolvedTheme()).toBe('light');

			service.toggleTheme();
			expect(service.theme()).toBe('dark');
			expect(service.resolvedTheme()).toBe('dark');

			service.toggleTheme();
			expect(service.theme()).toBe('light');
			expect(service.resolvedTheme()).toBe('light');
		});

		it('should persist theme to cookie', () => {
			service.setTheme('dark');
			expect(document.cookie).toContain('mcms-theme=dark');
		});
	});
});
