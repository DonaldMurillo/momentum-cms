import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Permissions for a single collection.
 */
export interface CollectionPermissions {
	slug: string;
	canAccess: boolean;
	canCreate: boolean;
	canRead: boolean;
	canUpdate: boolean;
	canDelete: boolean;
}

/**
 * Response from the /api/access endpoint.
 */
interface AccessResponse {
	collections: CollectionPermissions[];
}

/**
 * Collection Access Service
 *
 * Manages collection-level access permissions for the admin panel.
 * Fetches permissions from the server and provides reactive state
 * for guards and components to use.
 *
 * @example
 * ```typescript
 * const accessService = inject(CollectionAccessService);
 *
 * // Load permissions
 * await accessService.loadAccess();
 *
 * // Check access
 * if (accessService.canAccess('posts')) {
 *   // Show posts collection
 * }
 *
 * // Check specific operation
 * if (accessService.canCreate('posts')) {
 *   // Show create button
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CollectionAccessService {
	private readonly http = inject(HttpClient);

	// === Writable signals (internal state) ===

	/** Full permissions for all collections */
	private readonly _permissions = signal<CollectionPermissions[]>([]);

	/** Whether permissions are being loaded */
	readonly loading = signal(true);

	/** Whether permissions have been loaded at least once */
	readonly initialized = signal(false);

	/** Error message if loading failed */
	readonly error = signal<string | null>(null);

	// === Computed signals (derived state) ===

	/** All collection permissions (read-only) */
	readonly permissions = computed(() => this._permissions());

	/** Slugs of collections the user can access in admin panel */
	readonly accessibleCollections = computed(() =>
		this._permissions()
			.filter((p) => p.canAccess)
			.map((p) => p.slug),
	);

	/** Tracks in-flight load to prevent duplicate requests */
	private loadPromise: Promise<void> | null = null;

	/**
	 * Load collection permissions from the server.
	 * Should be called when the user authenticates or on app init.
	 * Safe to call concurrently from multiple guards.
	 */
	async loadAccess(): Promise<void> {
		// Return existing promise if loading is already in progress
		if (this.loadPromise) {
			return this.loadPromise;
		}

		this.loadPromise = this.doLoadAccess();
		try {
			await this.loadPromise;
		} finally {
			this.loadPromise = null;
		}
	}

	private async doLoadAccess(): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const response = await firstValueFrom(
				this.http.get<AccessResponse>('/api/access', {
					withCredentials: true,
				}),
			);

			this._permissions.set(response.collections);
			this.initialized.set(true);
		} catch {
			this.error.set('Failed to load collection permissions');
			// Set empty permissions on error
			this._permissions.set([]);
		} finally {
			this.loading.set(false);
		}
	}

	/**
	 * Reset permissions state.
	 * Should be called when the user logs out.
	 */
	reset(): void {
		this._permissions.set([]);
		this.initialized.set(false);
		this.error.set(null);
	}

	/**
	 * Check if the user can access a collection in the admin panel.
	 */
	canAccess(slug: string): boolean {
		const perms = this.getPermissions(slug);
		return perms?.canAccess ?? false;
	}

	/**
	 * Check if the user can create documents in a collection.
	 */
	canCreate(slug: string): boolean {
		const perms = this.getPermissions(slug);
		return perms?.canCreate ?? false;
	}

	/**
	 * Check if the user can read documents in a collection.
	 */
	canRead(slug: string): boolean {
		const perms = this.getPermissions(slug);
		return perms?.canRead ?? false;
	}

	/**
	 * Check if the user can update documents in a collection.
	 */
	canUpdate(slug: string): boolean {
		const perms = this.getPermissions(slug);
		return perms?.canUpdate ?? false;
	}

	/**
	 * Check if the user can delete documents in a collection.
	 */
	canDelete(slug: string): boolean {
		const perms = this.getPermissions(slug);
		return perms?.canDelete ?? false;
	}

	/**
	 * Get full permissions for a specific collection.
	 */
	getPermissions(slug: string): CollectionPermissions | undefined {
		return this._permissions().find((p) => p.slug === slug);
	}
}
