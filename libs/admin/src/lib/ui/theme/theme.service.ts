import {
	Injectable,
	signal,
	computed,
	effect,
	PLATFORM_ID,
	inject,
	DestroyRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Theme options for the admin UI.
 */
export type McmsTheme = 'light' | 'dark' | 'system';

/**
 * Storage key for persisting theme preference.
 */
const THEME_STORAGE_KEY = 'mcms-theme';

/**
 * Theme service for Momentum CMS Admin UI.
 *
 * Provides reactive theme state with system preference detection,
 * localStorage persistence, and dark mode toggle.
 *
 * Usage:
 * ```typescript
 * @Component({...})
 * export class MyComponent {
 *   private readonly theme = inject(McmsThemeService);
 *
 *   toggleDarkMode(): void {
 *     this.theme.toggleTheme();
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class McmsThemeService {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly isBrowser = isPlatformBrowser(this.platformId);

	/**
	 * Current theme setting (light, dark, or system).
	 */
	readonly theme = signal<McmsTheme>(this.loadTheme());

	/**
	 * Resolved theme after applying system preference.
	 * Always returns either 'light' or 'dark'.
	 */
	readonly resolvedTheme = computed((): 'light' | 'dark' => {
		const currentTheme = this.theme();
		if (currentTheme === 'system') {
			return this.getSystemPreference();
		}
		return currentTheme;
	});

	/**
	 * Whether the resolved theme is dark.
	 */
	readonly isDark = computed((): boolean => {
		return this.resolvedTheme() === 'dark';
	});

	constructor() {
		// Apply theme changes to DOM
		if (this.isBrowser) {
			effect(() => {
				const isDark = this.isDark();
				this.applyThemeToDOM(isDark);
			});

			// Listen for system preference changes
			this.listenForSystemPreferenceChanges();
		}
	}

	/**
	 * Sets the theme and persists to localStorage.
	 */
	setTheme(theme: McmsTheme): void {
		this.theme.set(theme);

		if (this.isBrowser) {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		}
	}

	/**
	 * Toggles between light and dark themes.
	 * If currently on system, uses the resolved preference as starting point.
	 */
	toggleTheme(): void {
		const current = this.resolvedTheme();
		this.setTheme(current === 'dark' ? 'light' : 'dark');
	}

	/**
	 * Loads theme from localStorage or defaults to 'system'.
	 */
	private loadTheme(): McmsTheme {
		if (!this.isBrowser) {
			return 'system';
		}

		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === 'light' || stored === 'dark' || stored === 'system') {
			return stored;
		}

		return 'system';
	}

	/**
	 * Gets the system color scheme preference.
	 */
	private getSystemPreference(): 'light' | 'dark' {
		if (!this.isBrowser) {
			return 'light';
		}

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		return mediaQuery.matches ? 'dark' : 'light';
	}

	/**
	 * Applies theme class to document element.
	 */
	private applyThemeToDOM(isDark: boolean): void {
		if (!this.isBrowser) {
			return;
		}

		if (isDark) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	/**
	 * Listens for system preference changes when theme is set to 'system'.
	 */
	private listenForSystemPreferenceChanges(): void {
		if (!this.isBrowser) {
			return;
		}

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

		const handleChange = (): void => {
			// Only react if theme is set to 'system'
			if (this.theme() === 'system') {
				// The computed signal will automatically update
				// when we trigger a re-evaluation
				this.theme.set('system');
			}
		};

		mediaQuery.addEventListener('change', handleChange);

		// Clean up the listener when the service is destroyed
		const destroyRef = inject(DestroyRef);
		destroyRef.onDestroy(() => {
			mediaQuery.removeEventListener('change', handleChange);
		});
	}
}
