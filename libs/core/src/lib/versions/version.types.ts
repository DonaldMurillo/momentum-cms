/**
 * Version Types for Momentum CMS
 * Defines the structure of document versions and drafts
 */

// ============================================
// Document Status
// ============================================

/**
 * Status of a document in a versioned collection.
 * - 'draft': Document is not publicly visible
 * - 'published': Document is publicly visible
 */
export type DocumentStatus = 'draft' | 'published';

// ============================================
// Document Version
// ============================================

/**
 * Represents a single version of a document.
 * Each version stores a full snapshot of the document at a point in time.
 */
export interface DocumentVersion {
	/** Unique identifier for this version */
	id: string;

	/** ID of the parent document this version belongs to */
	parent: string;

	/** Full document snapshot stored as JSON string */
	version: string;

	/** Status of this version */
	_status: DocumentStatus;

	/** Whether this version was created by autosave */
	autosave: boolean;

	/** When this version was published (if published) */
	publishedAt?: string;

	/** When this version was created */
	createdAt: string;

	/** When this version was last updated */
	updatedAt: string;
}

/**
 * Document version with parsed version data.
 * Used when returning versions to the API layer.
 */
export interface DocumentVersionParsed<T = Record<string, unknown>> {
	/** Unique identifier for this version */
	id: string;

	/** ID of the parent document this version belongs to */
	parent: string;

	/** Parsed document snapshot */
	version: T;

	/** Status of this version */
	_status: DocumentStatus;

	/** Whether this version was created by autosave */
	autosave: boolean;

	/** When this version was published (if published) */
	publishedAt?: string;

	/** When this version was created */
	createdAt: string;

	/** When this version was last updated */
	updatedAt: string;
}

// ============================================
// Query Options
// ============================================

/**
 * Options for counting versions (filter options only, no pagination).
 */
export interface VersionCountOptions {
	/** Include autosave versions in count (default: false) */
	includeAutosave?: boolean;

	/** Filter by status */
	status?: DocumentStatus;
}

/**
 * Options for querying versions of a document.
 */
export interface VersionQueryOptions extends VersionCountOptions {
	/** Maximum number of versions to return */
	limit?: number;

	/** Page number for pagination (1-based) */
	page?: number;

	/** Sort order (default: 'desc' = newest first) */
	sort?: 'asc' | 'desc';
}

/**
 * Result of a version query with pagination info.
 */
export interface VersionQueryResult<T = Record<string, unknown>> {
	/** Array of versions */
	docs: DocumentVersionParsed<T>[];

	/** Total number of versions */
	totalDocs: number;

	/** Total number of pages */
	totalPages: number;

	/** Current page number */
	page: number;

	/** Items per page */
	limit: number;

	/** Whether there is a next page */
	hasNextPage: boolean;

	/** Whether there is a previous page */
	hasPrevPage: boolean;
}

// ============================================
// Version Operations Options
// ============================================

/**
 * Options for restoring a version.
 */
export interface RestoreVersionOptions {
	/** The version ID to restore */
	versionId: string;

	/** Whether to publish the restored version immediately (default: false) */
	publish?: boolean;
}

/**
 * Options for creating a version.
 */
export interface CreateVersionOptions {
	/** Status of the new version */
	status?: DocumentStatus;

	/** Whether this is an autosave version */
	autosave?: boolean;
}

/**
 * Options for publishing a document.
 */
export interface PublishOptions {
	/** Scheduled publish date (ISO string). If provided, document will be scheduled for future publishing. */
	scheduledPublishAt?: string;
}

// ============================================
// Version Events (for hooks)
// ============================================

/**
 * Event data passed to version-related hooks.
 */
export interface VersionHookArgs {
	/** The version being operated on */
	version: DocumentVersion;

	/** The parent document ID */
	parentId: string;

	/** The collection slug */
	collection: string;

	/** The operation being performed */
	operation: 'create' | 'restore' | 'publish' | 'unpublish' | 'delete';
}
