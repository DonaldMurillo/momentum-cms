/**
 * Extended McmsThemeService tests covering:
 * - listenForSystemPreferenceChanges handleChange callback (lines 158-164)
 * - mediaQuery null guard (line 156)
 * - Cookie persistence via setTheme (line 91)
 * - applyThemeToDOM via effect when toggling themes
 * - DestroyRef cleanup of media query listener
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { vi, type Mock } from 'vitest';
import { McmsThemeService } from '../theme.service';

interface MockMediaQueryList {
	matches: boolean;
	addEventListener: Mock;
	removeEventListener: Mock;
}

/**
 * Helper: set up matchMedia mock and configure TestBed for browser context.
 * Returns the mock media query object and a cleanup function.
 */
function setupBrowserTestBed(mediaQueryOverrides?: Partial<MockMediaQueryList>): {
	mockMediaQuery: MockMediaQueryList;
	originalMatchMedia: typeof window.matchMedia;
} {
	const mockMediaQuery: MockMediaQueryList = {
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		...mediaQueryOverrides,
	};

	const originalMatchMedia = window.matchMedia;
	window.matchMedia = vi
		.fn()
		.mockReturnValue(mockMediaQuery) as unknown as typeof window.matchMedia;

	TestBed.configureTestingModule({
		providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
	});

	return { mockMediaQuery, originalMatchMedia };
}

describe('McmsThemeService - extended coverage', () => {
	/**
	 * Helper to invoke the captured change handler with a null safety check.
	 * Throws a descriptive error if the handler was never captured.
	 */
	function invokeChangeHandler(handler: (() => void) | null): void {
		if (handler === null) {
			throw new Error('changeHandler was not captured - addEventListener was not called');
		}
		handler();
	}

	describe('listenForSystemPreferenceChanges - handleChange callback', () => {
		let service: McmsThemeService;
		let originalMatchMedia: typeof window.matchMedia;
		let changeHandler: (() => void) | null = null;
		let mockMediaQuery: MockMediaQueryList;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');

			changeHandler = null;

			const result = setupBrowserTestBed({
				addEventListener: vi.fn((event: string, handler: () => void) => {
					if (event === 'change') {
						changeHandler = handler;
					}
				}),
			});

			mockMediaQuery = result.mockMediaQuery;
			originalMatchMedia = result.originalMatchMedia;
			service = TestBed.inject(McmsThemeService);
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should register an addEventListener on matchMedia for change events', () => {
			expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
			expect(changeHandler).not.toBeNull();
		});

		it('should re-set theme to system when handleChange fires and theme is system', () => {
			// Theme defaults to 'system' since no localStorage value is set.
			expect(service.theme()).toBe('system');

			const themeSpy = vi.spyOn(service.theme, 'set');

			// Simulate the system preference change event.
			invokeChangeHandler(changeHandler);

			// The handleChange callback calls this.theme.set('system') to trigger
			// re-evaluation of the computed signals.
			expect(themeSpy).toHaveBeenCalledWith('system');
		});

		it('should NOT re-set theme when handleChange fires and theme is dark', () => {
			service.setTheme('dark');
			expect(service.theme()).toBe('dark');

			const themeSpy = vi.spyOn(service.theme, 'set');

			invokeChangeHandler(changeHandler);

			// When theme is not 'system', handleChange should not call theme.set.
			expect(themeSpy).not.toHaveBeenCalled();
		});

		it('should NOT re-set theme when handleChange fires and theme is light', () => {
			service.setTheme('light');
			expect(service.theme()).toBe('light');

			const themeSpy = vi.spyOn(service.theme, 'set');

			invokeChangeHandler(changeHandler);

			expect(themeSpy).not.toHaveBeenCalled();
		});

		it('should resolve to dark when system preference changes to dark and theme is system', () => {
			expect(service.theme()).toBe('system');

			// Update the mock to say system preference is now dark.
			mockMediaQuery.matches = true;

			// Invoke the handleChange callback which triggers re-evaluation.
			invokeChangeHandler(changeHandler);

			expect(service.resolvedTheme()).toBe('dark');
			expect(service.isDark()).toBe(true);
		});

		it('should resolve to light when system preference is light and theme is system', () => {
			expect(service.theme()).toBe('system');

			mockMediaQuery.matches = false;

			invokeChangeHandler(changeHandler);

			expect(service.resolvedTheme()).toBe('light');
			expect(service.isDark()).toBe(false);
		});
	});

	describe('listenForSystemPreferenceChanges - matchMedia returns undefined', () => {
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');

			originalMatchMedia = window.matchMedia;
			window.matchMedia = vi.fn().mockReturnValue(undefined) as unknown as typeof window.matchMedia;

			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
			});
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should handle matchMedia returning undefined gracefully', () => {
			// Should not throw - the guard exits early when mediaQuery is falsy.
			const service = TestBed.inject(McmsThemeService);
			expect(service.theme()).toBe('system');
		});
	});

	describe('listenForSystemPreferenceChanges - matchMedia returns null', () => {
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');

			originalMatchMedia = window.matchMedia;
			window.matchMedia = vi.fn().mockReturnValue(null) as unknown as typeof window.matchMedia;

			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
			});
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should handle matchMedia returning null gracefully', () => {
			const service = TestBed.inject(McmsThemeService);
			expect(service.theme()).toBe('system');
		});
	});

	describe('cookie persistence in setTheme', () => {
		let service: McmsThemeService;
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			// Clear cookies
			document.cookie = 'mcms-theme=; path=/; max-age=0';

			const result = setupBrowserTestBed();
			originalMatchMedia = result.originalMatchMedia;
			service = TestBed.inject(McmsThemeService);
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			document.cookie = 'mcms-theme=; path=/; max-age=0';
			window.matchMedia = originalMatchMedia;
		});

		it('should persist dark theme to cookie when setTheme is called', () => {
			service.setTheme('dark');
			expect(document.cookie).toContain('mcms-theme=dark');
		});

		it('should persist light theme to cookie when setTheme is called', () => {
			service.setTheme('light');
			expect(document.cookie).toContain('mcms-theme=light');
		});

		it('should persist system theme to cookie when setTheme is called', () => {
			service.setTheme('system');
			expect(document.cookie).toContain('mcms-theme=system');
		});

		it('should update cookie when theme is changed multiple times', () => {
			service.setTheme('dark');
			expect(document.cookie).toContain('mcms-theme=dark');

			service.setTheme('light');
			expect(document.cookie).toContain('mcms-theme=light');
		});
	});

	describe('applyThemeToDOM via effect', () => {
		let service: McmsThemeService;
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');

			const result = setupBrowserTestBed();
			originalMatchMedia = result.originalMatchMedia;
			service = TestBed.inject(McmsThemeService);
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should add dark class to documentElement when theme is set to dark', () => {
			service.setTheme('dark');
			TestBed.flushEffects();

			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});

		it('should remove dark class from documentElement when theme is set to light', () => {
			// First apply dark, then switch to light.
			service.setTheme('dark');
			TestBed.flushEffects();
			expect(document.documentElement.classList.contains('dark')).toBe(true);

			service.setTheme('light');
			TestBed.flushEffects();
			expect(document.documentElement.classList.contains('dark')).toBe(false);
		});

		it('should not have dark class when system preference is light and theme is system', () => {
			// matchMedia.matches is false (light system pref).
			service.setTheme('system');
			TestBed.flushEffects();

			expect(document.documentElement.classList.contains('dark')).toBe(false);
		});

		it('should toggle DOM class when toggleTheme is called', () => {
			service.setTheme('light');
			TestBed.flushEffects();
			expect(document.documentElement.classList.contains('dark')).toBe(false);

			service.toggleTheme();
			TestBed.flushEffects();
			expect(document.documentElement.classList.contains('dark')).toBe(true);

			service.toggleTheme();
			TestBed.flushEffects();
			expect(document.documentElement.classList.contains('dark')).toBe(false);
		});
	});

	describe('applyThemeToDOM - dark system preference', () => {
		let service: McmsThemeService;
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');

			const result = setupBrowserTestBed({ matches: true });
			originalMatchMedia = result.originalMatchMedia;
			service = TestBed.inject(McmsThemeService);
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should add dark class when system preference is dark and theme is system', () => {
			expect(service.theme()).toBe('system');
			TestBed.flushEffects();

			expect(document.documentElement.classList.contains('dark')).toBe(true);
		});
	});

	describe('DestroyRef cleanup', () => {
		let originalMatchMedia: typeof window.matchMedia;
		let mockMediaQuery: MockMediaQueryList;

		beforeEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');

			const result = setupBrowserTestBed();
			mockMediaQuery = result.mockMediaQuery;
			originalMatchMedia = result.originalMatchMedia;
		});

		afterEach(() => {
			localStorage.removeItem('mcms-theme');
			document.documentElement.classList.remove('dark');
			window.matchMedia = originalMatchMedia;
		});

		it('should register change event listener on creation and remove it on destroy', () => {
			TestBed.inject(McmsThemeService);

			// The handler was registered.
			expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

			// Capture the handler that was registered.
			const registeredHandler = mockMediaQuery.addEventListener.mock.calls[0][1] as () => void;

			// Destroy the TestBed environment, which triggers DestroyRef callbacks.
			TestBed.resetTestingModule();

			// The removeEventListener should have been called with the same handler.
			expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', registeredHandler);
		});
	});

	describe('server context - setTheme does not persist', () => {
		let service: McmsThemeService;

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
			});

			service = TestBed.inject(McmsThemeService);
		});

		it('should not set cookie on server', () => {
			const cookieBefore = document.cookie;
			service.setTheme('dark');
			// On server, document.cookie should not be modified by the service.
			// The service skips the cookie write because isBrowser is false.
			expect(service.theme()).toBe('dark');
			expect(document.cookie).toBe(cookieBefore);
		});

		it('should resolve system as light on server', () => {
			service.setTheme('system');
			// Server getSystemPreference returns 'light'.
			expect(service.resolvedTheme()).toBe('light');
		});
	});
});
