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
	readVersions?: AccessFunction; // For version-enabled collections
}

// ============================================
// Hooks
// ============================================

export interface HookArgs {
	req: RequestContext;
	data?: Record<string, unknown>;
	doc?: Record<string, unknown>;
	operation?: 'create' | 'update' | 'delete';
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
}

// ============================================
// Custom Endpoints
// ============================================

export interface EndpointConfig {
	path: string;
	method: 'get' | 'post' | 'put' | 'patch' | 'delete';
	handler: (args: {
		req: RequestContext;
		collection: CollectionConfig;
	}) => Promise<{ status: number; body: unknown }>;
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
