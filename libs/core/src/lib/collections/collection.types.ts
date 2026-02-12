/**
 * Collection Types for Momentum CMS
 * Defines the structure of collections (similar to Payload CMS)
 */

import type { Field } from '../fields/field.types';

// ============================================
// Access Control
// ============================================

export interface AccessArgs {
	req: RequestContext;
	id?: string | number;
	data?: Record<string, unknown>;
}

export interface RequestContext {
	user?: UserContext;
	headers?: Record<string, string>;
	// Add more request context as needed
}

export interface UserContext {
	id: string | number;
	email?: string;
	role?: string;
	[key: string]: unknown;
}

export type AccessFunction = (args: AccessArgs) => boolean | Promise<boolean>;

export interface AccessConfig {
	create?: AccessFunction;
	read?: AccessFunction;
	update?: AccessFunction;
	delete?: AccessFunction;
	admin?: AccessFunction;
	unlock?: AccessFunction; // For auth-enabled collections

	/** Control who can restore soft-deleted documents (falls back to update access) */
	restore?: AccessFunction;
	/** Control who can permanently delete soft-deleted documents (falls back to delete access) */
	forceDelete?: AccessFunction;

	// Version-related access control
	/** Control who can read version history */
	readVersions?: AccessFunction;
	/** Control who can publish/unpublish documents */
	publishVersions?: AccessFunction;
	/** Control who can restore previous versions */
	restoreVersions?: AccessFunction;
}

// ============================================
// Hooks
// ============================================

export interface HookArgs {
	req: RequestContext;
	data?: Record<string, unknown>;
	doc?: Record<string, unknown>;
	operation?: 'create' | 'update' | 'delete' | 'softDelete' | 'restore';
	originalDoc?: Record<string, unknown>;
}

export type HookFunction = (
	args: HookArgs,
) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;

export interface HooksConfig {
	beforeValidate?: HookFunction[];
	beforeChange?: HookFunction[];
	afterChange?: HookFunction[];
	beforeRead?: HookFunction[];
	afterRead?: HookFunction[];
	beforeDelete?: HookFunction[];
	afterDelete?: HookFunction[];
	beforeRestore?: HookFunction[];
	afterRestore?: HookFunction[];
}

// ============================================
// Admin Configuration
// ============================================

export interface AdminConfig {
	/** Field to use as the document title in the admin UI */
	useAsTitle?: string;

	/** Default columns to show in list view */
	defaultColumns?: string[];

	/** Admin sidebar group */
	group?: string;

	/** Fields searchable in admin list */
	listSearchableFields?: string[];

	/** Pagination settings */
	pagination?: {
		defaultLimit?: number;
		limits?: number[];
	};

	/** Custom description for admin UI */
	description?: string;

	/** Hide from admin navigation */
	hidden?: boolean;

	/** Enable preview mode */
	preview?: boolean | ((doc: Record<string, unknown>) => string);
}

// ============================================
// Versioning
// ============================================

export interface VersionsConfig {
	/** Enable draft versions */
	drafts?: boolean | DraftsConfig;

	/** Maximum versions to keep per document */
	maxPerDoc?: number;
}

export interface DraftsConfig {
	/** Auto-save drafts */
	autosave?: boolean | AutosaveConfig;
}

export interface AutosaveConfig {
	/** Interval in milliseconds */
	interval?: number;
}

// ============================================
// Authentication
// ============================================

export interface AuthConfig {
	/** Enable token-based auth */
	tokenExpiration?: number;

	/** Verify email before login */
	verify?: boolean;

	/** Max login attempts before lockout */
	maxLoginAttempts?: number;

	/** Lockout interval in milliseconds */
	lockTime?: number;

	/** Cookies configuration */
	cookies?: {
		secure?: boolean;
		sameSite?: 'strict' | 'lax' | 'none';
		domain?: string;
	};
}

// ============================================
// Soft Delete
// ============================================

export interface SoftDeleteConfig {
	/** Column name for the deletion timestamp. @default 'deletedAt' */
	field?: string;

	/** Auto-purge soft-deleted records after this many days. Undefined means never purge. */
	retentionDays?: number;
}

// ============================================
// Timestamps
// ============================================

export interface TimestampsConfig {
	/** Add createdAt field */
	createdAt?: boolean;

	/** Add updatedAt field */
	updatedAt?: boolean;
}

// ============================================
// Collection Configuration
// ============================================

export interface CollectionConfig {
	/** Unique identifier for the collection (used in URLs and database) */
	slug: string;

	/** Custom labels */
	labels?: {
		singular?: string;
		plural?: string;
	};

	/** Field definitions */
	fields: Field[];

	/** Admin panel configuration */
	admin?: AdminConfig;

	/** Access control functions */
	access?: AccessConfig;

	/** Lifecycle hooks */
	hooks?: HooksConfig;

	/** Enable authentication for this collection (makes it a user collection) */
	auth?: boolean | AuthConfig;

	/** Enable versioning */
	versions?: boolean | VersionsConfig;

	/** Timestamps configuration */
	timestamps?: boolean | TimestampsConfig;

	/** Enable soft deletes (sets deletedAt instead of removing row) */
	softDelete?: boolean | SoftDeleteConfig;

	/** Custom database table/collection name */
	dbName?: string;

	/** Default sort field */
	defaultSort?: string;

	/** GraphQL configuration */
	graphQL?: {
		singularName?: string;
		pluralName?: string;
		disableQueries?: boolean;
		disableMutations?: boolean;
	};

	/** Custom endpoints */
	endpoints?: EndpointConfig[];

	/** Webhook subscriptions for this collection */
	webhooks?: WebhookConfig[];
}

// ============================================
// Webhooks
// ============================================

/** Events that trigger webhooks. */
export type WebhookEvent = 'afterChange' | 'afterDelete' | 'afterCreate' | 'afterUpdate';

/** Configuration for a single webhook subscription. */
export interface WebhookConfig {
	/** URL to send the webhook POST request to. */
	url: string;
	/** Events that trigger this webhook. Defaults to all events. */
	events?: WebhookEvent[];
	/** Secret for HMAC-SHA256 signature verification. */
	secret?: string;
	/** Maximum retries on failure. @default 0 */
	retries?: number;
	/** Custom headers to include in the request. */
	headers?: Record<string, string>;
}

/** Payload sent in webhook POST requests. */
export interface WebhookPayload {
	/** The event that triggered the webhook. */
	event: WebhookEvent;
	/** The collection slug. */
	collection: string;
	/** The operation type. */
	operation: 'create' | 'update' | 'delete' | 'softDelete' | 'restore';
	/** Timestamp of the event. */
	timestamp: string;
	/** The document data (after the operation). */
	doc: Record<string, unknown>;
	/** The previous document data (for updates). */
	previousDoc?: Record<string, unknown>;
}

// ============================================
// Custom Endpoints
// ============================================

/** Response from a custom endpoint handler. */
export interface EndpointResponse {
	status: number;
	body: unknown;
}

/** Arguments passed to custom endpoint handlers. */
export interface EndpointArgs {
	/** Request context (user, headers) */
	req: RequestContext;
	/** This collection's config */
	collection: CollectionConfig;
	/** Request body (for POST/PUT/PATCH endpoints) */
	body?: Record<string, unknown>;
	/**
	 * Async helper to query any collection.
	 * Returns the raw API result (find returns { docs, totalDocs }, findById returns doc, etc.).
	 * Abstracts away server-core imports so collections remain isomorphic.
	 */
	query: EndpointQueryHelper;
}

/** Query helper for custom endpoints - provides access to collection data without server-core imports. */
export interface EndpointQueryHelper {
	find: (
		slug: string,
		options?: { limit?: number; page?: number },
	) => Promise<{ docs: Record<string, unknown>[]; totalDocs: number }>;
	findById: (slug: string, id: string) => Promise<Record<string, unknown> | null>;
	count: (slug: string) => Promise<number>;
	create: (slug: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
	update: (
		slug: string,
		id: string,
		data: Record<string, unknown>,
	) => Promise<Record<string, unknown>>;
	delete: (slug: string, id: string) => Promise<{ id: string; deleted: boolean }>;
	/**
	 * Execute multiple operations within a database transaction.
	 * All operations succeed or all are rolled back.
	 * Falls back to non-transactional execution if adapter doesn't support transactions.
	 */
	transaction: <T>(callback: (query: EndpointQueryHelper) => Promise<T>) => Promise<T>;
}

export interface EndpointConfig {
	path: string;
	method: 'get' | 'post' | 'put' | 'patch' | 'delete';
	handler: (args: EndpointArgs) => Promise<EndpointResponse>;
}

// ============================================
// Globals (Single documents)
// ============================================

export interface GlobalConfig {
	slug: string;
	label?: string;
	fields: Field[];
	admin?: Omit<AdminConfig, 'useAsTitle' | 'defaultColumns' | 'pagination'>;
	access?: Pick<AccessConfig, 'read' | 'update'>;
	hooks?: Pick<
		HooksConfig,
		'beforeValidate' | 'beforeChange' | 'afterChange' | 'beforeRead' | 'afterRead'
	>;
	versions?: boolean | VersionsConfig;
}
