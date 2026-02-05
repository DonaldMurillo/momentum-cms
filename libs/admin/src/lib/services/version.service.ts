/**
 * Version Service for Angular Admin UI
 *
 * Provides version management operations for versioned collections.
 * Works in both SSR and browser contexts.
 */

import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ============================================
// Types
// ============================================

/**
 * Document status for versioned collections.
 */
export type DocumentStatus = 'draft' | 'published';

/**
 * Version query options.
 */
export interface VersionFindOptions {
	limit?: number;
	page?: number;
	includeAutosave?: boolean;
	status?: DocumentStatus;
}

/**
 * Parsed document version with typed data.
 */
export interface DocumentVersionParsed<T = Record<string, unknown>> {
	id: string;
	parent: string;
	version: T;
	_status: DocumentStatus;
	autosave: boolean;
	publishedAt?: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Result of a version query with pagination.
 */
export interface VersionQueryResult<T = Record<string, unknown>> {
	docs: DocumentVersionParsed<T>[];
	totalDocs: number;
	totalPages: number;
	page: number;
	limit: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

/**
 * Options for restoring a version.
 */
export interface RestoreVersionOptions {
	versionId: string;
	publish?: boolean;
}

/**
 * Result of a restore operation.
 */
export interface RestoreResult<T = Record<string, unknown>> {
	doc: T;
	message: string;
}

/**
 * Result of a publish/unpublish operation.
 */
export interface PublishResult<T = Record<string, unknown>> {
	doc: T;
	message: string;
}

/**
 * Result of a draft save operation.
 */
export interface DraftSaveResult<T = Record<string, unknown>> {
	version: DocumentVersionParsed<T>;
	message: string;
}

/**
 * Result of a status query.
 */
export interface StatusResult {
	status: DocumentStatus;
}

/**
 * A single field difference between two versions.
 */
export interface VersionFieldDiff {
	field: string;
	oldValue: unknown;
	newValue: unknown;
}

/**
 * Result of comparing two versions.
 */
export interface VersionCompareResult {
	differences: VersionFieldDiff[];
}

// ============================================
// Version Service
// ============================================

/**
 * Service for managing document versions in the admin UI.
 *
 * @example
 * ```typescript
 * @Component({...})
 * export class VersionHistoryComponent {
 *   private readonly versionService = inject(VersionService);
 *
 *   readonly versions = signal<DocumentVersionParsed[]>([]);
 *   readonly isLoading = signal(false);
 *
 *   async loadVersions(collection: string, docId: string): Promise<void> {
 *     this.isLoading.set(true);
 *     const result = await this.versionService.findVersions(collection, docId);
 *     this.versions.set(result.docs);
 *     this.isLoading.set(false);
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
	private readonly http = inject(HttpClient);

	/** Loading state signal */
	readonly isLoading = signal(false);

	/** Error state signal */
	readonly error = signal<string | null>(null);

	/** Last saved timestamp signal */
	readonly lastSaved = signal<Date | null>(null);

	// ============================================
	// Version Operations
	// ============================================

	/**
	 * Find all versions for a document.
	 */
	findVersions$<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		options?: VersionFindOptions,
	): Observable<VersionQueryResult<T>> {
		const url = this.buildUrl(collection, docId, 'versions');
		const params = this.buildParams(options);
		return this.http.get<VersionQueryResult<T>>(url, { params });
	}

	/**
	 * Find all versions for a document (Promise version).
	 */
	async findVersions<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		options?: VersionFindOptions,
	): Promise<VersionQueryResult<T>> {
		return firstValueFrom(this.findVersions$<T>(collection, docId, options));
	}

	/**
	 * Find a specific version by ID.
	 */
	findVersionById$<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		versionId: string,
	): Observable<DocumentVersionParsed<T>> {
		const url = this.buildUrl(collection, docId, 'versions', versionId);
		return this.http.get<DocumentVersionParsed<T>>(url);
	}

	/**
	 * Find a specific version by ID (Promise version).
	 */
	async findVersionById<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		versionId: string,
	): Promise<DocumentVersionParsed<T>> {
		return firstValueFrom(this.findVersionById$<T>(collection, docId, versionId));
	}

	/**
	 * Restore a document to a previous version.
	 */
	restore$<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		options: RestoreVersionOptions,
	): Observable<RestoreResult<T>> {
		const url = this.buildUrl(collection, docId, 'versions', 'restore');
		return this.http.post<RestoreResult<T>>(url, options);
	}

	/**
	 * Restore a document to a previous version (Promise version).
	 */
	async restore<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		options: RestoreVersionOptions,
	): Promise<RestoreResult<T>> {
		return firstValueFrom(this.restore$<T>(collection, docId, options));
	}

	/**
	 * Publish a document.
	 */
	publish$<T = Record<string, unknown>>(
		collection: string,
		docId: string,
	): Observable<PublishResult<T>> {
		const url = this.buildUrl(collection, docId, 'publish');
		return this.http.post<PublishResult<T>>(url, {});
	}

	/**
	 * Publish a document (Promise version).
	 */
	async publish<T = Record<string, unknown>>(
		collection: string,
		docId: string,
	): Promise<PublishResult<T>> {
		return firstValueFrom(this.publish$<T>(collection, docId));
	}

	/**
	 * Unpublish a document.
	 */
	unpublish$<T = Record<string, unknown>>(
		collection: string,
		docId: string,
	): Observable<PublishResult<T>> {
		const url = this.buildUrl(collection, docId, 'unpublish');
		return this.http.post<PublishResult<T>>(url, {});
	}

	/**
	 * Unpublish a document (Promise version).
	 */
	async unpublish<T = Record<string, unknown>>(
		collection: string,
		docId: string,
	): Promise<PublishResult<T>> {
		return firstValueFrom(this.unpublish$<T>(collection, docId));
	}

	/**
	 * Save a draft version (autosave).
	 */
	saveDraft$<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		data: Partial<T>,
	): Observable<DraftSaveResult<T>> {
		const url = this.buildUrl(collection, docId, 'draft');
		return this.http.post<DraftSaveResult<T>>(url, data).pipe(
			map((result) => {
				this.lastSaved.set(new Date());
				return result;
			}),
		);
	}

	/**
	 * Save a draft version (Promise version).
	 */
	async saveDraft<T = Record<string, unknown>>(
		collection: string,
		docId: string,
		data: Partial<T>,
	): Promise<DraftSaveResult<T>> {
		return firstValueFrom(this.saveDraft$<T>(collection, docId, data));
	}

	/**
	 * Get the current status of a document.
	 */
	getStatus$(collection: string, docId: string): Observable<DocumentStatus> {
		const url = this.buildUrl(collection, docId, 'status');
		return this.http.get<StatusResult>(url).pipe(map((result) => result.status));
	}

	/**
	 * Get the current status of a document (Promise version).
	 */
	async getStatus(collection: string, docId: string): Promise<DocumentStatus> {
		return firstValueFrom(this.getStatus$(collection, docId));
	}

	// ============================================
	// Compare Methods
	// ============================================

	/**
	 * Compare two versions and return field-level differences.
	 */
	compareVersions$(
		collection: string,
		docId: string,
		versionId1: string,
		versionId2: string,
	): Observable<VersionFieldDiff[]> {
		const url = this.buildUrl(collection, docId, 'versions', 'compare');
		return this.http
			.post<VersionCompareResult>(url, { versionId1, versionId2 })
			.pipe(map((result) => result.differences));
	}

	/**
	 * Compare two versions and return field-level differences (Promise version).
	 */
	async compareVersions(
		collection: string,
		docId: string,
		versionId1: string,
		versionId2: string,
	): Promise<VersionFieldDiff[]> {
		return firstValueFrom(this.compareVersions$(collection, docId, versionId1, versionId2));
	}

	// ============================================
	// Helper Methods
	// ============================================

	/**
	 * Build the API URL for version operations.
	 */
	private buildUrl(collection: string, docId: string, ...path: string[]): string {
		const basePath = '/api';
		const segments = [basePath, collection, docId, ...path];
		return segments.join('/');
	}

	/**
	 * Build query params from options.
	 */
	private buildParams(options?: VersionFindOptions): Record<string, string> {
		const params: Record<string, string> = {};

		if (options?.limit !== undefined) {
			params['limit'] = String(options.limit);
		}
		if (options?.page !== undefined) {
			params['page'] = String(options.page);
		}
		if (options?.includeAutosave !== undefined) {
			params['includeAutosave'] = String(options.includeAutosave);
		}
		if (options?.status !== undefined) {
			params['status'] = options.status;
		}

		return params;
	}
}

// ============================================
// Injection Helper
// ============================================

/**
 * Inject the Version Service.
 *
 * @example
 * ```typescript
 * @Component({...})
 * export class VersionHistoryComponent {
 *   private readonly versionService = injectVersionService();
 *
 *   async restoreVersion(versionId: string): Promise<void> {
 *     await this.versionService.restore(this.collection, this.docId, {
 *       versionId,
 *       publish: false,
 *     });
 *   }
 * }
 * ```
 */
export function injectVersionService(): VersionService {
	return inject(VersionService);
}
