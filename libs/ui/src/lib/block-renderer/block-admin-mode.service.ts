/**
 * Block Admin Mode Service
 *
 * Runtime-togglable service controlling whether block admin mode is active.
 * When active, the BlockRendererComponent shows hover overlays with edit buttons.
 *
 * Unlike the deprecated BLOCK_ADMIN_MODE injection token (compile-time boolean),
 * this service can be toggled at runtime via query param, admin toolbar, or API.
 *
 * The `isAdmin` property can be replaced with a computed signal to derive admin
 * mode from an external reactive source (e.g., auth service).
 */

import { Injectable, isSignal, signal, type Provider, type Signal } from '@angular/core';

@Injectable()
export class BlockAdminModeService {
	private readonly _isAdmin = signal(false);

	/** Current admin mode state. Can be replaced with a computed for reactive sources. */
	isAdmin: Signal<boolean> = this._isAdmin.asReadonly();

	enable(): void {
		this._isAdmin.set(true);
	}

	disable(): void {
		this._isAdmin.set(false);
	}

	toggle(): void {
		this._isAdmin.update((v) => !v);
	}
}

/**
 * Provide BlockAdminModeService with an initial value or reactive signal source.
 *
 * @param initialValue - Whether admin mode starts enabled.
 *   Can be a boolean, a factory function (for SSR safety), or a Signal<boolean>
 *   to reactively derive admin mode from an external source.
 *
 * @example
 * ```typescript
 * // Static value
 * providers: [...provideBlockAdminMode(true)]
 *
 * // Factory function
 * providers: [...provideBlockAdminMode(() => isInPreviewIframe())]
 *
 * // Reactive signal source
 * providers: [...provideBlockAdminMode(authService.isAdmin)]
 * ```
 */
export function provideBlockAdminMode(
	initialValue: boolean | (() => boolean) | Signal<boolean> = false,
): Provider[] {
	return [
		{
			provide: BlockAdminModeService,
			useFactory: (): BlockAdminModeService => {
				const service = new BlockAdminModeService();
				if (isSignal(initialValue)) {
					service.isAdmin = initialValue;
				} else {
					const value = typeof initialValue === 'function' ? initialValue() : initialValue;
					if (value) {
						service.enable();
					}
				}
				return service;
			},
		},
	];
}
