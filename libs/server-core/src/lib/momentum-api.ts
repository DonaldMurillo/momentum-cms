/**
 * Momentum API Implementation
 *
 * Provides direct database access for server-side operations.
 * This is the core of the Momentum API that both SSR and Express use.
 */

import type {
	MomentumConfig,
	DatabaseAdapter,
	CollectionConfig,
	GlobalConfig,
	Field,
	AccessArgs,
	HookArgs,
	RequestContext,
} from '@momentum-cms/core';
import { createLogger } from '@momentum-cms/logger';
import {
	flattenDataFields,
	validateFieldConstraints,
	getSoftDeleteField,
} from '@momentum-cms/core';
import {
	hasFieldAccessControl,
	filterCreatableFields,
	filterUpdatableFields,
	filterReadableFields,
} from './field-access';
import { hasFieldHooks, runFieldHooks } from './field-hooks';
import { populateRelationships } from './relationship-populator';
import type {
	MomentumAPI,
	MomentumAPIContext,
	CollectionOperations,
	GlobalOperations,
	FindOptions,
	FindResult,
	DeleteResult,
	WhereClause,
	FieldValidationError,
	VersionOperations,
} from './momentum-api.types';
import { VersionOperationsImpl } from './version-operations';
import {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	GlobalNotFoundError,
	ValidationError,
} from './momentum-api.types';

// ============================================
// Singleton Management
// ============================================

let momentumApiInstance: MomentumAPIImpl | null = null;

/**
 * Initialize the Momentum API singleton.
 * Must be called once at server startup before using getMomentumAPI().
 *
 * @param config - The Momentum configuration
 * @returns The initialized API instance
 *
 * @example
 * ```typescript
 * // In server.ts
 * import { initializeMomentumAPI } from '@momentum-cms/server-core';
 * import momentumConfig from './momentum.config';
 *
 * initializeMomentumAPI(momentumConfig);
 * ```
 */
export function initializeMomentumAPI(config: MomentumConfig): MomentumAPI {
	if (momentumApiInstance) {
		createLogger('API').warn('Already initialized, returning existing instance');
		return momentumApiInstance;
	}
	momentumApiInstance = new MomentumAPIImpl(config);
	return momentumApiInstance;
}

/**
 * Get the initialized Momentum API singleton.
 * Throws if not initialized.
 *
 * @returns The API instance
 * @throws Error if not initialized
 *
 * @example
 * ```typescript
 * const api = getMomentumAPI();
 * const posts = await api.collection('posts').find();
 * ```
 */
export function getMomentumAPI(): MomentumAPI {
	if (!momentumApiInstance) {
		throw new Error(
			'MomentumAPI not initialized. Call initializeMomentumAPI(config) first in your server startup.',
		);
	}
	return momentumApiInstance;
}

/**
 * Check if the Momentum API has been initialized.
 */
export function isMomentumAPIInitialized(): boolean {
	return momentumApiInstance !== null;
}

/**
 * Reset the Momentum API singleton.
 * Primarily used for testing.
 */
export function resetMomentumAPI(): void {
	momentumApiInstance = null;
}

// ============================================
// MomentumAPI Implementation
// ============================================

class MomentumAPIImpl implements MomentumAPI {
	private readonly config: MomentumConfig;
	private readonly adapter: DatabaseAdapter;
	private readonly context: MomentumAPIContext;

	constructor(config: MomentumConfig, context: MomentumAPIContext = {}) {
		this.config = config;
		this.adapter = config.db.adapter;
		this.context = context;
	}

	collection<T = Record<string, unknown>>(slug: string): CollectionOperations<T> {
		const collectionConfig = this.config.collections.find((c) => c.slug === slug);
		if (!collectionConfig) {
			throw new CollectionNotFoundError(slug);
		}

		return new CollectionOperationsImpl<T>(
			slug,
			collectionConfig,
			this.adapter,
			this.context,
			this.config.collections,
		);
	}

	global<T = Record<string, unknown>>(slug: string): GlobalOperations<T> {
		const globals = this.config.globals ?? [];
		const globalConfig = globals.find((g) => g.slug === slug);
		if (!globalConfig) {
			throw new GlobalNotFoundError(slug);
		}

		return new GlobalOperationsImpl<T>(
			slug,
			globalConfig,
			this.adapter,
			this.context,
			this.config.collections,
		);
	}

	getConfig(): MomentumConfig {
		return this.config;
	}

	setContext(ctx: MomentumAPIContext): MomentumAPI {
		// Return new instance with merged context (immutable pattern)
		return new MomentumAPIImpl(this.config, { ...this.context, ...ctx });
	}

	getContext(): MomentumAPIContext {
		return { ...this.context };
	}
}

// ============================================
// Where Clause Helpers
// ============================================

/**
 * Flattens a structured WhereClause into simple key-value pairs for the adapter.
 * Converts { field: { equals: value } } to { field: value }.
 * Direct values like { field: value } are passed through unchanged.
 */
function flattenWhereClause(where: WhereClause | undefined): Record<string, unknown> {
	if (!where) return {};
	const result: Record<string, unknown> = {};
	for (const [field, condition] of Object.entries(where)) {
		if (typeof condition === 'object' && condition !== null && 'equals' in condition) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Where clause operator object
			result[field] = (condition as Record<string, unknown>)['equals'];
		} else {
			result[field] = condition;
		}
	}
	return result;
}

// ============================================
// Collection Operations Implementation
// ============================================

/**
 * Implementation of collection operations.
 * Type assertions are necessary here because the DatabaseAdapter returns
 * Record<string, unknown> while the generic type T represents the user's
 * document type. These conversions are safe as the adapter stores whatever
 * data was passed to it.
 */
class CollectionOperationsImpl<T> implements CollectionOperations<T> {
	constructor(
		private readonly slug: string,
		private readonly collectionConfig: CollectionConfig,
		private readonly adapter: DatabaseAdapter,
		private readonly context: MomentumAPIContext,
		private readonly allCollections: CollectionConfig[] = [],
	) {}

	async find(options: FindOptions = {}): Promise<FindResult<T>> {
		// Check read access
		await this.checkAccess('read');

		// Run beforeRead hooks
		await this.runBeforeReadHooks();

		// Prepare query options (strip depth and where — they need special handling)
		const limit = options.limit ?? 10;
		const page = options.page ?? 1;
		const { depth: _depth, where, withDeleted: _wd, onlyDeleted: _od, ...queryOptions } = options;
		const whereParams = flattenWhereClause(where);

		// Inject soft-delete filter
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (softDeleteField && !options.withDeleted && !options.onlyDeleted) {
			whereParams[softDeleteField] = null;
		} else if (softDeleteField && options.onlyDeleted) {
			whereParams[softDeleteField] = { $ne: null };
		}

		// Inject defaultWhere constraints (e.g., user-scoped filtering)
		if (this.collectionConfig.defaultWhere) {
			const constraints = this.collectionConfig.defaultWhere(this.buildRequestContext());
			if (constraints) {
				Object.assign(whereParams, constraints);
			}
		}

		const query: Record<string, unknown> = {
			...queryOptions,
			...whereParams,
			limit,
			page,
		};

		// Execute query with pagination (adapter handles LIMIT/OFFSET)
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>[], safe cast to T[]
		const docs = (await this.adapter.find(this.slug, query)) as T[];

		// Run afterRead hooks on each document
		let afterHookDocs = await this.processAfterReadHooks(docs);

		// Populate relationships if depth > 0 (clamped to prevent resource exhaustion)
		const MAX_RELATIONSHIP_DEPTH = 10;
		const depth = Math.min(options.depth ?? 0, MAX_RELATIONSHIP_DEPTH);
		if (depth > 0) {
			afterHookDocs = await Promise.all(
				afterHookDocs.map(async (doc) => {
					const populated = await populateRelationships(
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
						doc as Record<string, unknown>,
						this.collectionConfig.fields,
						{
							depth,
							collections: this.allCollections,
							adapter: this.adapter,
							req: this.buildRequestContext(),
						},
					);
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Record<string, unknown> is compatible with T
					return populated as T;
				}),
			);
		}

		// Get total count for pagination metadata
		// Use a separate count query without limit/offset/depth to get the true total
		const countQuery: Record<string, unknown> = { ...queryOptions, ...whereParams };
		delete countQuery['limit'];
		delete countQuery['page'];
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>[], safe cast to T[]
		const allDocs = (await this.adapter.find(this.slug, {
			...countQuery,
			limit: 0, // Signal to adapter: count-only (returns all if not supported)
		})) as T[];
		const totalDocs = allDocs.length;
		const totalPages = Math.ceil(totalDocs / limit) || 1;

		return {
			docs: afterHookDocs,
			totalDocs,
			totalPages,
			page,
			limit,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
			nextPage: page < totalPages ? page + 1 : undefined,
			prevPage: page > 1 ? page - 1 : undefined,
		};
	}

	async findById(
		id: string,
		options?: { depth?: number; withDeleted?: boolean },
	): Promise<T | null> {
		// Check read access
		await this.checkAccess('read', id);

		// Run beforeRead hooks
		await this.runBeforeReadHooks();

		// Execute query
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown> | null, safe cast to T | null
		const doc = (await this.adapter.findById(this.slug, id)) as T | null;

		if (!doc) {
			return null;
		}

		// Filter out soft-deleted documents unless explicitly requested
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (
			softDeleteField &&
			!options?.withDeleted &&
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
			(doc as Record<string, unknown>)[softDeleteField]
		) {
			return null;
		}

		// Filter by defaultWhere constraints (e.g., user-scoped filtering)
		if (this.collectionConfig.defaultWhere) {
			const constraints = this.collectionConfig.defaultWhere(this.buildRequestContext());
			if (constraints) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
				const record = doc as Record<string, unknown>;
				for (const [key, value] of Object.entries(constraints)) {
					if (record[key] !== value) {
						return null;
					}
				}
			}
		}

		// Run afterRead hooks
		const [processed] = await this.processAfterReadHooks([doc]);

		// Populate relationships if depth > 0 (clamped to prevent resource exhaustion)
		const MAX_RELATIONSHIP_DEPTH = 10;
		const depth = Math.min(options?.depth ?? 0, MAX_RELATIONSHIP_DEPTH);
		if (depth > 0) {
			const populated = await populateRelationships(
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
				processed as Record<string, unknown>,
				this.collectionConfig.fields,
				{
					depth,
					collections: this.allCollections,
					adapter: this.adapter,
					req: this.buildRequestContext(),
				},
			);
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Record<string, unknown> is compatible with T
			return populated as T;
		}

		return processed;
	}

	async create(data: Partial<T>): Promise<T> {
		// Check create access
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial<T> is compatible with Record<string, unknown>
		await this.checkAccess('create', undefined, data as Record<string, unknown>);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial<T> is compatible with Record<string, unknown>
		let processedData = data as Record<string, unknown>;

		// Strip the soft-delete field from create data to prevent injection
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (softDeleteField && softDeleteField in processedData) {
			const { [softDeleteField]: _stripped, ...rest } = processedData;
			processedData = rest;
		}

		// Filter fields the user cannot create (field-level access)
		if (hasFieldAccessControl(this.collectionConfig.fields)) {
			processedData = await filterCreatableFields(
				this.collectionConfig.fields,
				processedData,
				this.buildRequestContext(),
			);
		}

		// Run field-level beforeValidate hooks
		if (hasFieldHooks(this.collectionConfig.fields)) {
			processedData = await runFieldHooks(
				'beforeValidate',
				this.collectionConfig.fields,
				processedData,
				this.buildRequestContext(),
				'create',
			);
		}

		// Run collection-level beforeValidate hooks
		processedData = await this.runHooks('beforeValidate', processedData, 'create');

		// Validate required fields
		const errors = await this.validateData(processedData, false);
		if (errors.length > 0) {
			throw new ValidationError(errors);
		}

		// Run field-level beforeChange hooks
		if (hasFieldHooks(this.collectionConfig.fields)) {
			processedData = await runFieldHooks(
				'beforeChange',
				this.collectionConfig.fields,
				processedData,
				this.buildRequestContext(),
				'create',
			);
		}

		// Run collection-level beforeChange hooks
		processedData = await this.runHooks('beforeChange', processedData, 'create');

		// Execute create
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast to T
		const doc = (await this.adapter.create(this.slug, processedData)) as T;

		// Run collection-level afterChange hooks
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
		await this.runHooks('afterChange', doc as Record<string, unknown>, 'create');

		// Run field-level afterChange hooks
		if (hasFieldHooks(this.collectionConfig.fields)) {
			await runFieldHooks(
				'afterChange',
				this.collectionConfig.fields,
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
				doc as Record<string, unknown>,
				this.buildRequestContext(),
				'create',
			);
		}

		return doc;
	}

	async update(id: string, data: Partial<T>): Promise<T> {
		// Check update access
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial<T> is compatible with Record<string, unknown>
		await this.checkAccess('update', id, data as Record<string, unknown>);

		// Get original document
		const originalDoc = await this.adapter.findById(this.slug, id);
		if (!originalDoc) {
			throw new DocumentNotFoundError(this.slug, id);
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial<T> is compatible with Record<string, unknown>
		let processedData = data as Record<string, unknown>;

		// Strip the soft-delete field from update data to prevent access control bypass
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (softDeleteField && softDeleteField in processedData) {
			const { [softDeleteField]: _stripped, ...rest } = processedData;
			processedData = rest;
		}

		// Filter fields the user cannot update (field-level access)
		if (hasFieldAccessControl(this.collectionConfig.fields)) {
			processedData = await filterUpdatableFields(
				this.collectionConfig.fields,
				processedData,
				this.buildRequestContext(),
			);
		}

		// Run field-level beforeValidate hooks
		if (hasFieldHooks(this.collectionConfig.fields)) {
			processedData = await runFieldHooks(
				'beforeValidate',
				this.collectionConfig.fields,
				processedData,
				this.buildRequestContext(),
				'update',
			);
		}

		// Run collection-level beforeValidate hooks
		processedData = await this.runHooks('beforeValidate', processedData, 'update', originalDoc);

		// Validate fields (partial validation for updates)
		const errors = await this.validateData(processedData, true);
		if (errors.length > 0) {
			throw new ValidationError(errors);
		}

		// Run field-level beforeChange hooks
		if (hasFieldHooks(this.collectionConfig.fields)) {
			processedData = await runFieldHooks(
				'beforeChange',
				this.collectionConfig.fields,
				processedData,
				this.buildRequestContext(),
				'update',
			);
		}

		// Run collection-level beforeChange hooks
		processedData = await this.runHooks('beforeChange', processedData, 'update', originalDoc);

		// Execute update
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast to T
		const doc = (await this.adapter.update(this.slug, id, processedData)) as T;

		// Run collection-level afterChange hooks
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
		await this.runHooks('afterChange', doc as Record<string, unknown>, 'update', originalDoc);

		// Run field-level afterChange hooks
		if (hasFieldHooks(this.collectionConfig.fields)) {
			await runFieldHooks(
				'afterChange',
				this.collectionConfig.fields,
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
				doc as Record<string, unknown>,
				this.buildRequestContext(),
				'update',
			);
		}

		return doc;
	}

	async delete(id: string): Promise<DeleteResult> {
		// Check delete access
		await this.checkAccess('delete', id);

		// Get document first (for hooks)
		const doc = await this.adapter.findById(this.slug, id);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, id);
		}

		const softDeleteField = getSoftDeleteField(this.collectionConfig);

		if (softDeleteField) {
			// Soft delete: set deletedAt timestamp
			await this.runDeleteHooks('beforeDelete', doc, 'softDelete');

			if (this.adapter.softDelete) {
				await this.adapter.softDelete(this.slug, id, softDeleteField);
			} else {
				await this.adapter.update(this.slug, id, {
					[softDeleteField]: new Date().toISOString(),
				});
			}

			await this.runDeleteHooks('afterDelete', doc, 'softDelete');
			return { id, deleted: true };
		}

		// Hard delete (original behavior)
		await this.runDeleteHooks('beforeDelete', doc);
		const deleted = await this.adapter.delete(this.slug, id);
		await this.runDeleteHooks('afterDelete', doc);

		return { id, deleted };
	}

	async forceDelete(id: string): Promise<DeleteResult> {
		// Check forceDelete access (fall back to delete access)
		const forceDeleteAccessFn = this.collectionConfig.access?.forceDelete;
		if (forceDeleteAccessFn) {
			const accessArgs: AccessArgs = {
				req: this.buildRequestContext(),
				id,
			};
			const allowed = await Promise.resolve(forceDeleteAccessFn(accessArgs));
			if (!allowed) {
				throw new AccessDeniedError('forceDelete', this.slug);
			}
		} else {
			await this.checkAccess('delete', id);
		}

		// Get document first (for hooks)
		const doc = await this.adapter.findById(this.slug, id);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, id);
		}

		// Always hard delete
		await this.runDeleteHooks('beforeDelete', doc);
		const deleted = await this.adapter.delete(this.slug, id);
		await this.runDeleteHooks('afterDelete', doc);

		return { id, deleted };
	}

	async restore(id: string): Promise<T> {
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (!softDeleteField) {
			throw new Error(`Collection "${this.slug}" does not have soft delete enabled`);
		}

		// Check restore access (fall back to update access)
		const restoreAccessFn = this.collectionConfig.access?.restore;
		if (restoreAccessFn) {
			const accessArgs: AccessArgs = {
				req: this.buildRequestContext(),
				id,
			};
			const allowed = await Promise.resolve(restoreAccessFn(accessArgs));
			if (!allowed) {
				throw new AccessDeniedError('restore', this.slug);
			}
		} else {
			await this.checkAccess('update', id);
		}

		// Get the document (must exist, even if soft-deleted)
		const doc = await this.adapter.findById(this.slug, id);
		if (!doc) {
			throw new DocumentNotFoundError(this.slug, id);
		}

		if (!doc[softDeleteField]) {
			throw new Error('Document is not soft-deleted');
		}

		// Run beforeRestore hooks
		await this.runRestoreHooks('beforeRestore', doc);

		// Restore the document
		let restored: Record<string, unknown>;
		if (this.adapter.restore) {
			restored = await this.adapter.restore(this.slug, id, softDeleteField);
		} else {
			restored = await this.adapter.update(this.slug, id, { [softDeleteField]: null });
		}

		// Run afterRestore hooks
		await this.runRestoreHooks('afterRestore', restored);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast to T
		return restored as T;
	}

	async search(
		query: string,
		options?: { fields?: string[]; limit?: number; page?: number },
	): Promise<FindResult<T>> {
		// Check read access
		await this.checkAccess('read');

		const limit = options?.limit ?? 20;
		const page = options?.page ?? 1;

		// Determine searchable fields: use provided fields, or auto-detect text-like types
		let searchFields = options?.fields;
		if (!searchFields || searchFields.length === 0) {
			const dataFields = flattenDataFields(this.collectionConfig.fields);
			const searchableTypes = new Set(['text', 'textarea', 'email', 'richText']);
			searchFields = dataFields.filter((f) => searchableTypes.has(f.type)).map((f) => f.name);
		}

		if (searchFields.length === 0 || !query.trim()) {
			return {
				docs: [],
				totalDocs: 0,
				totalPages: 0,
				page,
				limit,
				hasNextPage: false,
				hasPrevPage: false,
			};
		}

		// Build soft-delete filter for search results
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		const softDeleteFilter: Record<string, unknown> = {};
		if (softDeleteField) {
			softDeleteFilter[softDeleteField] = null;
		}

		// Use the adapter's search method if available, otherwise fall back to find
		let docs: Record<string, unknown>[];
		if (this.adapter.search) {
			docs = await this.adapter.search(this.slug, query, searchFields, { limit, page });
			// Filter out soft-deleted documents from search results
			if (softDeleteField) {
				docs = docs.filter((doc) => !doc[softDeleteField]);
			}
		} else {
			// Fallback: basic find with soft-delete filter
			docs = await this.adapter.find(this.slug, { ...softDeleteFilter, limit, page });
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>[], safe cast to T[]
		const resolvedDocs = docs as unknown as T[];

		const totalDocs = resolvedDocs.length;
		const totalPages = Math.max(1, Math.ceil(totalDocs / limit));

		return {
			docs: resolvedDocs,
			totalDocs,
			totalPages,
			page,
			limit,
			hasNextPage: page < totalPages,
			hasPrevPage: page > 1,
			nextPage: page < totalPages ? page + 1 : undefined,
			prevPage: page > 1 ? page - 1 : undefined,
		};
	}

	async count(where?: WhereClause, options?: { withDeleted?: boolean }): Promise<number> {
		// Check read access
		await this.checkAccess('read');

		// Use find with where clause and count results
		// Pass limit: 0 to signal we want all matching docs for counting
		const whereParams = flattenWhereClause(where);

		// Inject soft-delete filter
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (softDeleteField && !options?.withDeleted) {
			whereParams[softDeleteField] = null;
		}

		const query: Record<string, unknown> = { ...whereParams, limit: 0 };
		const docs = await this.adapter.find(this.slug, query);
		return docs.length;
	}

	async batchCreate(items: Partial<T>[]): Promise<T[]> {
		if (items.length === 0) return [];

		const doCreate = async (): Promise<T[]> => {
			const results: T[] = [];
			for (const item of items) {
				results.push(await this.create(item));
			}
			return results;
		};

		// Use transaction if available
		if (this.adapter.transaction) {
			return this.adapter.transaction(async (txAdapter) => {
				// Create a new collection ops with the txAdapter
				const txOps = new CollectionOperationsImpl<T>(
					this.slug,
					this.collectionConfig,
					txAdapter,
					this.context,
				);
				const results: T[] = [];
				for (const item of items) {
					results.push(await txOps.create(item));
				}
				return results;
			});
		}

		return doCreate();
	}

	async batchUpdate(items: { id: string; data: Partial<T> }[]): Promise<T[]> {
		if (items.length === 0) return [];

		const doUpdate = async (): Promise<T[]> => {
			const results: T[] = [];
			for (const item of items) {
				results.push(await this.update(item.id, item.data));
			}
			return results;
		};

		// Use transaction if available
		if (this.adapter.transaction) {
			return this.adapter.transaction(async (txAdapter) => {
				const txOps = new CollectionOperationsImpl<T>(
					this.slug,
					this.collectionConfig,
					txAdapter,
					this.context,
				);
				const results: T[] = [];
				for (const item of items) {
					results.push(await txOps.update(item.id, item.data));
				}
				return results;
			});
		}

		return doUpdate();
	}

	async batchDelete(ids: string[]): Promise<DeleteResult[]> {
		if (ids.length === 0) return [];

		const doDelete = async (): Promise<DeleteResult[]> => {
			const results: DeleteResult[] = [];
			for (const id of ids) {
				results.push(await this.delete(id));
			}
			return results;
		};

		// Use transaction if available
		if (this.adapter.transaction) {
			return this.adapter.transaction(async (txAdapter) => {
				const txOps = new CollectionOperationsImpl<T>(
					this.slug,
					this.collectionConfig,
					txAdapter,
					this.context,
				);
				const results: DeleteResult[] = [];
				for (const id of ids) {
					results.push(await txOps.delete(id));
				}
				return results;
			});
		}

		return doDelete();
	}

	/**
	 * Get version operations for this collection.
	 * Returns null if versioning is not enabled for this collection.
	 */
	versions(): VersionOperations<T> | null {
		// Check if versioning is enabled for this collection
		if (!this.collectionConfig.versions) {
			return null;
		}

		return new VersionOperationsImpl<T>(
			this.slug,
			this.collectionConfig,
			this.adapter,
			this.context,
		);
	}

	// ============================================
	// Private Helpers
	// ============================================

	private async checkAccess(
		operation: 'create' | 'read' | 'update' | 'delete',
		id?: string,
		data?: Record<string, unknown>,
	): Promise<void> {
		const accessFn = this.collectionConfig.access?.[operation];
		if (!accessFn) {
			// No access function defined = allow all
			return;
		}

		const accessArgs: AccessArgs = {
			req: this.buildRequestContext(),
			id,
			data,
		};

		const allowed = await Promise.resolve(accessFn(accessArgs));
		if (!allowed) {
			throw new AccessDeniedError(operation, this.slug);
		}
	}

	private buildRequestContext(): RequestContext {
		return {
			user: this.context.user,
		};
	}

	private async validateData(
		data: Record<string, unknown>,
		isUpdate: boolean,
	): Promise<FieldValidationError[]> {
		return this.validateFields(this.collectionConfig.fields, data, isUpdate);
	}

	/**
	 * Recursively validate fields, including nested groups, arrays, and blocks.
	 */
	private async validateFields(
		fields: Field[],
		data: Record<string, unknown>,
		isUpdate: boolean,
	): Promise<FieldValidationError[]> {
		const errors: FieldValidationError[] = [];
		// Flatten through layout fields (tabs, collapsible, row) to validate all data fields
		const dataFields = flattenDataFields(fields);

		for (const field of dataFields) {
			const value = data[field.name];
			const fieldLabel = field.label ?? field.name;

			// Check required fields (only on create, not on update)
			if (field.required && !isUpdate) {
				if (value === undefined || value === null || value === '') {
					errors.push({
						field: field.name,
						message: `${fieldLabel} is required`,
					});
				}
			}

			// Run built-in constraint validators (minLength, maxLength, min, max, etc.)
			if (value !== undefined && value !== null) {
				const constraintErrors = validateFieldConstraints(field, value);
				for (const err of constraintErrors) {
					errors.push({ field: err.field, message: err.message });
				}
			}

			// Run custom validator if present (supports both sync and async validators)
			if (field.validate && value !== undefined) {
				const result = await Promise.resolve(field.validate(value, { data, req: {} }));
				// ValidateFunction returns string (error message) or true (valid)
				if (typeof result === 'string') {
					errors.push({
						field: field.name,
						message: result,
					});
				}
			}

			// Recurse into group sub-fields
			if (field.type === 'group' && value && typeof value === 'object' && !Array.isArray(value)) {
				const groupErrors = await this.validateFields(
					field.fields,
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by typeof check above
					value as Record<string, unknown>,
					isUpdate,
				);
				errors.push(...groupErrors);
			}

			// Recurse into array row sub-fields
			if (field.type === 'array' && Array.isArray(value)) {
				for (const row of value) {
					if (row && typeof row === 'object' && !Array.isArray(row)) {
						const rowErrors = await this.validateFields(
							field.fields,
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by typeof check above
							row as Record<string, unknown>,
							isUpdate,
						);
						errors.push(...rowErrors);
					}
				}
			}

			// Recurse into blocks row sub-fields
			if (field.type === 'blocks' && Array.isArray(value)) {
				for (const row of value) {
					if (row && typeof row === 'object' && !Array.isArray(row)) {
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by typeof check above
						const blockRow = row as Record<string, unknown>;
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- blockType is string | undefined from Record
						const blockType = blockRow['blockType'] as string | undefined;
						if (blockType) {
							const blockConfig = field.blocks.find((b) => b.slug === blockType);
							if (blockConfig) {
								const blockErrors = await this.validateFields(
									blockConfig.fields,
									blockRow,
									isUpdate,
								);
								errors.push(...blockErrors);
							}
						}
					}
				}
			}
		}

		return errors;
	}

	private async runHooks(
		hookType: 'beforeValidate' | 'beforeChange' | 'afterChange',
		data: Record<string, unknown>,
		operation: 'create' | 'update',
		originalDoc?: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		const hooks = this.collectionConfig.hooks?.[hookType];
		if (!hooks || hooks.length === 0) {
			return data;
		}

		let processedData = { ...data };

		for (const hook of hooks) {
			const hookArgs: HookArgs = {
				req: this.buildRequestContext(),
				data: processedData,
				operation,
				originalDoc,
			};

			const result = await Promise.resolve(hook(hookArgs));
			if (result && typeof result === 'object') {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Hook returns object, safe cast
				processedData = result as Record<string, unknown>;
			}
		}

		return processedData;
	}

	private async runBeforeReadHooks(): Promise<void> {
		const hooks = this.collectionConfig.hooks?.beforeRead;
		if (!hooks || hooks.length === 0) {
			return;
		}

		for (const hook of hooks) {
			const hookArgs: HookArgs = {
				req: this.buildRequestContext(),
			};
			await Promise.resolve(hook(hookArgs));
		}
	}

	private async processAfterReadHooks(docs: T[]): Promise<T[]> {
		const hooks = this.collectionConfig.hooks?.afterRead;
		const hasCollectionHooks = hooks && hooks.length > 0;
		const hasFieldHooksConfig = hasFieldHooks(this.collectionConfig.fields);
		const hasFieldAccess = hasFieldAccessControl(this.collectionConfig.fields);

		if (!hasCollectionHooks && !hasFieldHooksConfig && !hasFieldAccess) {
			return docs;
		}

		const processedDocs: T[] = [];

		for (const doc of docs) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
			let processedDoc = doc as Record<string, unknown>;

			// Run collection-level afterRead hooks
			if (hasCollectionHooks) {
				for (const hook of hooks) {
					const hookArgs: HookArgs = {
						req: this.buildRequestContext(),
						doc: processedDoc,
					};

					const result = await Promise.resolve(hook(hookArgs));
					if (result && typeof result === 'object') {
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Hook returns object, safe cast
						processedDoc = result as Record<string, unknown>;
					}
				}
			}

			// Run field-level afterRead hooks
			if (hasFieldHooksConfig) {
				processedDoc = await runFieldHooks(
					'afterRead',
					this.collectionConfig.fields,
					processedDoc,
					this.buildRequestContext(),
					'read',
				);
			}

			// Filter fields the user cannot read (field-level access)
			if (hasFieldAccess) {
				processedDoc = await filterReadableFields(
					this.collectionConfig.fields,
					processedDoc,
					this.buildRequestContext(),
				);
			}

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Record<string, unknown> is compatible with T
			processedDocs.push(processedDoc as T);
		}

		return processedDocs;
	}

	private async runDeleteHooks(
		hookType: 'beforeDelete' | 'afterDelete',
		doc: Record<string, unknown>,
		operation: 'delete' | 'softDelete' = 'delete',
	): Promise<void> {
		const hooks = this.collectionConfig.hooks?.[hookType];
		if (!hooks || hooks.length === 0) {
			return;
		}

		for (const hook of hooks) {
			const hookArgs: HookArgs = {
				req: this.buildRequestContext(),
				doc,
				operation,
			};
			await Promise.resolve(hook(hookArgs));
		}
	}

	private async runRestoreHooks(
		hookType: 'beforeRestore' | 'afterRestore',
		doc: Record<string, unknown>,
	): Promise<void> {
		const hooks = this.collectionConfig.hooks?.[hookType];
		if (!hooks || hooks.length === 0) {
			return;
		}

		for (const hook of hooks) {
			const hookArgs: HookArgs = {
				req: this.buildRequestContext(),
				doc,
				operation: 'restore',
			};
			await Promise.resolve(hook(hookArgs));
		}
	}
}

// ============================================
// Global Operations Implementation
// ============================================

/**
 * Implementation of global operations (singleton documents).
 * Reuses the same hook/access/validation patterns as collections.
 */
class GlobalOperationsImpl<T> implements GlobalOperations<T> {
	private readonly log = createLogger('GlobalOps');

	constructor(
		private readonly slug: string,
		private readonly globalConfig: GlobalConfig,
		private readonly adapter: DatabaseAdapter,
		private readonly context: MomentumAPIContext,
		private readonly allCollections: CollectionConfig[] = [],
	) {}

	async findOne(options?: { depth?: number }): Promise<T> {
		// Check read access
		await this.checkAccess('read');

		// Run beforeRead hooks
		await this.runBeforeReadHooks();

		// Fetch from adapter
		let data: Record<string, unknown> | null = null;
		if (this.adapter.findGlobal) {
			data = await this.adapter.findGlobal(this.slug);
		}

		// Auto-create with empty data if not found
		if (!data) {
			this.log.info(`Global "${this.slug}" not found, auto-creating with defaults`);
			const defaults: Record<string, unknown> = {};
			if (this.adapter.updateGlobal) {
				data = await this.adapter.updateGlobal(this.slug, defaults);
			} else {
				data = { slug: this.slug, data: defaults };
			}
		}

		// Run afterRead hooks
		let processedData = data;
		const hooks = this.globalConfig.hooks?.afterRead;
		if (hooks && hooks.length > 0) {
			for (const hook of hooks) {
				const hookArgs: HookArgs = {
					req: this.buildRequestContext(),
					doc: processedData,
				};
				const result = await Promise.resolve(hook(hookArgs));
				if (result && typeof result === 'object') {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Hook returns object
					processedData = result as Record<string, unknown>;
				}
			}
		}

		// Filter readable fields
		if (hasFieldAccessControl(this.globalConfig.fields)) {
			processedData = await filterReadableFields(
				this.globalConfig.fields,
				processedData,
				this.buildRequestContext(),
			);
		}

		// Run field-level afterRead hooks
		if (hasFieldHooks(this.globalConfig.fields)) {
			processedData = await runFieldHooks(
				'afterRead',
				this.globalConfig.fields,
				processedData,
				this.buildRequestContext(),
				'read',
			);
		}

		// Populate relationships if depth > 0
		const MAX_RELATIONSHIP_DEPTH = 10;
		const depth = Math.min(options?.depth ?? 0, MAX_RELATIONSHIP_DEPTH);
		if (depth > 0) {
			processedData = await populateRelationships(processedData, this.globalConfig.fields, {
				depth,
				collections: this.allCollections,
				adapter: this.adapter,
				req: this.buildRequestContext(),
			});
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast
		return processedData as T;
	}

	async update(data: Partial<T>): Promise<T> {
		// Check update access
		await this.checkAccess('update');

		if (!this.adapter.updateGlobal) {
			throw new Error('Database adapter does not support globals');
		}

		// Get original data for hooks
		const originalData = this.adapter.findGlobal ? await this.adapter.findGlobal(this.slug) : null;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial<T> is compatible with Record<string, unknown>
		let processedData = data as Record<string, unknown>;

		// Filter fields the user cannot update (field-level access)
		if (hasFieldAccessControl(this.globalConfig.fields)) {
			processedData = await filterUpdatableFields(
				this.globalConfig.fields,
				processedData,
				this.buildRequestContext(),
			);
		}

		// Run field-level beforeValidate hooks
		if (hasFieldHooks(this.globalConfig.fields)) {
			processedData = await runFieldHooks(
				'beforeValidate',
				this.globalConfig.fields,
				processedData,
				this.buildRequestContext(),
				'update',
			);
		}

		// Run collection-level beforeValidate hooks
		processedData = await this.runHooks('beforeValidate', processedData, originalData);

		// Validate fields (partial validation for updates)
		const errors = this.validateData(processedData);
		if (errors.length > 0) {
			throw new ValidationError(errors);
		}

		// Run field-level beforeChange hooks
		if (hasFieldHooks(this.globalConfig.fields)) {
			processedData = await runFieldHooks(
				'beforeChange',
				this.globalConfig.fields,
				processedData,
				this.buildRequestContext(),
				'update',
			);
		}

		// Run collection-level beforeChange hooks
		processedData = await this.runHooks('beforeChange', processedData, originalData);

		// Merge with existing data so partial updates preserve unchanged fields
		const existingFields = originalData ? { ...originalData } : {};
		delete existingFields['slug'];
		delete existingFields['createdAt'];
		delete existingFields['updatedAt'];
		delete existingFields['data'];
		const mergedData = { ...existingFields, ...processedData };

		// Execute upsert
		const result = await this.adapter.updateGlobal(this.slug, mergedData);

		// Run collection-level afterChange hooks
		await this.runHooks('afterChange', result, originalData);

		// Run field-level afterChange hooks
		if (hasFieldHooks(this.globalConfig.fields)) {
			await runFieldHooks(
				'afterChange',
				this.globalConfig.fields,
				result,
				this.buildRequestContext(),
				'update',
			);
		}

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast
		return result as T;
	}

	// ============================================
	// Private Helpers
	// ============================================

	private async checkAccess(operation: 'read' | 'update'): Promise<void> {
		const accessFn = this.globalConfig.access?.[operation];
		if (!accessFn) return; // No access function = allow all

		const accessArgs: AccessArgs = {
			req: this.buildRequestContext(),
		};

		const allowed = await Promise.resolve(accessFn(accessArgs));
		if (!allowed) {
			throw new AccessDeniedError(operation, this.slug);
		}
	}

	private buildRequestContext(): RequestContext {
		return {
			user: this.context.user,
		};
	}

	private validateData(data: Record<string, unknown>): FieldValidationError[] {
		const errors: FieldValidationError[] = [];
		const dataFields = flattenDataFields(this.globalConfig.fields);

		for (const field of dataFields) {
			const value = data[field.name];

			// Run built-in constraint validators
			if (value !== undefined && value !== null) {
				const constraintErrors = validateFieldConstraints(field, value);
				for (const err of constraintErrors) {
					errors.push({ field: err.field, message: err.message });
				}
			}
		}

		return errors;
	}

	private async runHooks(
		hookType: 'beforeValidate' | 'beforeChange' | 'afterChange',
		data: Record<string, unknown>,
		originalDoc?: Record<string, unknown> | null,
	): Promise<Record<string, unknown>> {
		const hooks = this.globalConfig.hooks?.[hookType];
		if (!hooks || hooks.length === 0) return data;

		let processedData = { ...data };

		for (const hook of hooks) {
			const hookArgs: HookArgs = {
				req: this.buildRequestContext(),
				data: processedData,
				operation: 'update',
				originalDoc: originalDoc ?? undefined,
			};

			const result = await Promise.resolve(hook(hookArgs));
			if (result && typeof result === 'object') {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Hook returns object
				processedData = result as Record<string, unknown>;
			}
		}

		return processedData;
	}

	private async runBeforeReadHooks(): Promise<void> {
		const hooks = this.globalConfig.hooks?.beforeRead;
		if (!hooks || hooks.length === 0) return;

		for (const hook of hooks) {
			const hookArgs: HookArgs = {
				req: this.buildRequestContext(),
			};
			await Promise.resolve(hook(hookArgs));
		}
	}
}

// Re-export types for convenience
export type {
	MomentumAPI,
	MomentumAPIContext,
	CollectionOperations,
	GlobalOperations,
	FindOptions,
	FindResult,
	DeleteResult,
	WhereClause,
	FieldValidationError,
	VersionOperations,
	VersionFindOptions,
} from './momentum-api.types';

export {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	GlobalNotFoundError,
	ValidationError,
} from './momentum-api.types';

export { ReferentialIntegrityError } from '@momentum-cms/core';
