/**
 * Momentum API Types
 *
 * Type definitions for the Momentum API - a unified interface for
 * direct database access (server-side) and HTTP calls (browser-side).
 */

import type {
	MomentumConfig,
	UserContext,
	DocumentStatus,
	DocumentVersionParsed,
	VersionQueryResult,
	VersionQueryOptions,
	RestoreVersionOptions,
	PublishOptions,
} from '@momentum-cms/core';

// ============================================
// Context
// ============================================

/**
 * Context passed to API operations.
 * Used for access control and hook execution.
 */
export interface MomentumAPIContext {
	/** Current authenticated user */
	user?: UserContext;
	/** Locale for internationalized content */
	locale?: string;
	/** Fallback locale if primary not found */
	fallbackLocale?: string;
	/** Depth for relationship population */
	depth?: number;
	/** Show hidden fields (admin only) */
	showHiddenFields?: boolean;
}

// ============================================
// Query Options
// ============================================

/**
 * Options for find operations.
 */
export interface FindOptions {
	/** Filter conditions */
	where?: WhereClause;
	/** Sort field (prefix with - for descending) */
	sort?: string;
	/** Maximum documents to return */
	limit?: number;
	/** Page number (1-indexed) */
	page?: number;
	/** Depth for relationship population */
	depth?: number;
}

/**
 * Where clause for filtering documents.
 * Supports field-level operators like equals, contains, etc.
 */
export type WhereClause = Record<string, unknown>;

// ============================================
// Results
// ============================================

/**
 * Result of a find operation with pagination info.
 */
export interface FindResult<T> {
	/** Array of documents */
	docs: T[];
	/** Total number of matching documents */
	totalDocs: number;
	/** Total number of pages */
	totalPages: number;
	/** Current page number */
	page: number;
	/** Documents per page */
	limit: number;
	/** Whether there's a next page */
	hasNextPage: boolean;
	/** Whether there's a previous page */
	hasPrevPage: boolean;
	/** Next page number (if exists) */
	nextPage?: number;
	/** Previous page number (if exists) */
	prevPage?: number;
}

/**
 * Result of a delete operation.
 */
export interface DeleteResult {
	/** ID of the deleted document */
	id: string;
	/** Whether deletion was successful */
	deleted: boolean;
}

// ============================================
// Collection Operations
// ============================================

/**
 * Operations available on a collection.
 * Generic type T represents the document type.
 */
export interface CollectionOperations<T = Record<string, unknown>> {
	/**
	 * Find multiple documents matching the query.
	 */
	find(options?: FindOptions): Promise<FindResult<T>>;

	/**
	 * Find a single document by ID.
	 */
	findById(id: string, options?: { depth?: number }): Promise<T | null>;

	/**
	 * Create a new document.
	 */
	create(data: Partial<T>): Promise<T>;

	/**
	 * Update an existing document.
	 */
	update(id: string, data: Partial<T>): Promise<T>;

	/**
	 * Delete a document.
	 */
	delete(id: string): Promise<DeleteResult>;

	/**
	 * Count documents matching the query.
	 */
	count(where?: WhereClause): Promise<number>;

	/**
	 * Get version operations for this collection.
	 * Returns null if versioning is not enabled for this collection.
	 */
	versions(): VersionOperations<T> | null;
}

// ============================================
// Version Operations
// ============================================

/**
 * Options for finding versions.
 */
export interface VersionFindOptions extends VersionQueryOptions {
	/** Depth for relationship population in version data */
	depth?: number;
}

/**
 * Operations available for managing document versions.
 * Only available for collections with versioning enabled.
 */
export interface VersionOperations<T = Record<string, unknown>> {
	/**
	 * Find all versions for a document.
	 * Returns versions in descending order (newest first) by default.
	 *
	 * @param parentId - The document ID to get versions for
	 * @param options - Query options for pagination and filtering
	 */
	findVersions(parentId: string, options?: VersionFindOptions): Promise<VersionQueryResult<T>>;

	/**
	 * Find a specific version by ID.
	 *
	 * @param versionId - The version ID to retrieve
	 */
	findVersionById(versionId: string): Promise<DocumentVersionParsed<T> | null>;

	/**
	 * Restore a document to a previous version.
	 * Creates a new version with the restored data.
	 *
	 * @param options - Restore options including version ID
	 * @returns The updated document
	 */
	restore(options: RestoreVersionOptions): Promise<T>;

	/**
	 * Publish a document (change status from draft to published).
	 * Creates a new published version.
	 *
	 * @param docId - The document ID to publish
	 * @param options - Publish options (e.g., scheduled publish)
	 * @returns The published document
	 */
	publish(docId: string, options?: PublishOptions): Promise<T>;

	/**
	 * Unpublish a document (change status from published to draft).
	 *
	 * @param docId - The document ID to unpublish
	 * @returns The unpublished document
	 */
	unpublish(docId: string): Promise<T>;

	/**
	 * Save a draft version without changing the main document.
	 * Used for autosave functionality.
	 *
	 * @param docId - The document ID to save draft for
	 * @param data - The draft data
	 * @returns The created draft version
	 */
	saveDraft(docId: string, data: Partial<T>): Promise<DocumentVersionParsed<T>>;

	/**
	 * Get the current status of a document.
	 *
	 * @param docId - The document ID
	 * @returns The document status ('draft' or 'published')
	 */
	getStatus(docId: string): Promise<DocumentStatus>;

	/**
	 * Compare two versions of a document.
	 * Returns the differences between the versions.
	 *
	 * @param versionId1 - First version ID
	 * @param versionId2 - Second version ID
	 * @returns Object with field-level differences
	 */
	compare(
		versionId1: string,
		versionId2: string,
	): Promise<{ field: string; oldValue: unknown; newValue: unknown }[]>;
}

// ============================================
// Momentum API Interface
// ============================================

/**
 * The main Momentum API interface.
 *
 * Provides access to collection operations with optional context.
 *
 * @example
 * ```typescript
 * const api = getMomentumAPI();
 *
 * // Untyped usage
 * const posts = await api.collection('posts').find({ limit: 10 });
 *
 * // Typed usage
 * const typedPosts = await api.collection<Post>('posts').find();
 *
 * // With user context
 * const adminApi = api.setContext({ user: currentUser });
 * const result = await adminApi.collection('posts').create({ title: 'New Post' });
 * ```
 */
export interface MomentumAPI {
	/**
	 * Get operations for a specific collection.
	 *
	 * @param slug - The collection slug
	 * @returns Collection operations interface
	 */
	collection<T = Record<string, unknown>>(slug: string): CollectionOperations<T>;

	/**
	 * Get the current Momentum configuration.
	 */
	getConfig(): MomentumConfig;

	/**
	 * Create a new API instance with the specified context.
	 * The original instance is not modified (immutable pattern).
	 *
	 * @param ctx - Context to merge with existing context
	 * @returns New API instance with merged context
	 */
	setContext(ctx: MomentumAPIContext): MomentumAPI;

	/**
	 * Get the current context.
	 */
	getContext(): MomentumAPIContext;
}

// ============================================
// Error Types
// ============================================

/**
 * Error thrown when a collection is not found.
 */
export class CollectionNotFoundError extends Error {
	constructor(slug: string) {
		super(`Collection "${slug}" not found`);
		this.name = 'CollectionNotFoundError';
	}
}

/**
 * Error thrown when a document is not found.
 */
export class DocumentNotFoundError extends Error {
	constructor(collection: string, id: string) {
		super(`Document "${id}" not found in collection "${collection}"`);
		this.name = 'DocumentNotFoundError';
	}
}

/**
 * Error thrown when access is denied.
 */
export class AccessDeniedError extends Error {
	constructor(operation: string, collection: string) {
		super(`Access denied for ${operation} on collection "${collection}"`);
		this.name = 'AccessDeniedError';
	}
}

/**
 * Validation error for a specific field.
 */
export interface FieldValidationError {
	field: string;
	message: string;
}

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends Error {
	readonly errors: FieldValidationError[];

	constructor(errors: FieldValidationError[]) {
		super(`Validation failed: ${errors.map((e) => `${e.field}: ${e.message}`).join(', ')}`);
		this.name = 'ValidationError';
		this.errors = errors;
	}
}
