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
	AccessArgs,
	HookArgs,
	RequestContext,
} from '@momentum-cms/core';
import type {
	MomentumAPI,
	MomentumAPIContext,
	CollectionOperations,
	FindOptions,
	FindResult,
	DeleteResult,
	WhereClause,
	FieldValidationError,
} from './momentum-api.types';
import {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
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
		console.warn('MomentumAPI already initialized, returning existing instance');
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

		return new CollectionOperationsImpl<T>(slug, collectionConfig, this.adapter, this.context);
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
	) {}

	async find(options: FindOptions = {}): Promise<FindResult<T>> {
		// Check read access
		await this.checkAccess('read');

		// Run beforeRead hooks
		await this.runBeforeReadHooks();

		// Prepare query options
		const limit = options.limit ?? 10;
		const page = options.page ?? 1;
		const query: Record<string, unknown> = {
			...options,
			limit,
			page,
		};

		// Execute query
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>[], safe cast to T[]
		const docs = (await this.adapter.find(this.slug, query)) as T[];

		// Run afterRead hooks on each document
		const processedDocs = await this.processAfterReadHooks(docs);

		// Calculate pagination
		const totalDocs = docs.length; // TODO: Implement proper count query
		const totalPages = Math.ceil(totalDocs / limit) || 1;

		return {
			docs: processedDocs,
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

	async findById(id: string, _options?: { depth?: number }): Promise<T | null> {
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

		// Run afterRead hooks
		const [processed] = await this.processAfterReadHooks([doc]);
		return processed;
	}

	async create(data: Partial<T>): Promise<T> {
		// Check create access
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial<T> is compatible with Record<string, unknown>
		await this.checkAccess('create', undefined, data as Record<string, unknown>);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial<T> is compatible with Record<string, unknown>
		let processedData = data as Record<string, unknown>;

		// Run beforeValidate hooks
		processedData = await this.runHooks('beforeValidate', processedData, 'create');

		// Validate required fields
		const errors = this.validateData(processedData, false);
		if (errors.length > 0) {
			throw new ValidationError(errors);
		}

		// Run beforeChange hooks
		processedData = await this.runHooks('beforeChange', processedData, 'create');

		// Execute create
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast to T
		const doc = (await this.adapter.create(this.slug, processedData)) as T;

		// Run afterChange hooks
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
		await this.runHooks('afterChange', doc as Record<string, unknown>, 'create');

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

		// Run beforeValidate hooks
		processedData = await this.runHooks('beforeValidate', processedData, 'update', originalDoc);

		// Validate fields (partial validation for updates)
		const errors = this.validateData(processedData, true);
		if (errors.length > 0) {
			throw new ValidationError(errors);
		}

		// Run beforeChange hooks
		processedData = await this.runHooks('beforeChange', processedData, 'update', originalDoc);

		// Execute update
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown>, safe cast to T
		const doc = (await this.adapter.update(this.slug, id, processedData)) as T;

		// Run afterChange hooks
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
		await this.runHooks('afterChange', doc as Record<string, unknown>, 'update', originalDoc);

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

		// Run beforeDelete hooks
		await this.runDeleteHooks('beforeDelete', doc);

		// Execute delete
		const deleted = await this.adapter.delete(this.slug, id);

		// Run afterDelete hooks
		await this.runDeleteHooks('afterDelete', doc);

		return { id, deleted };
	}

	async count(where?: WhereClause): Promise<number> {
		// Check read access
		await this.checkAccess('read');

		// Use find with where clause and count results
		// TODO: Implement proper count query in adapter
		const docs = await this.adapter.find(this.slug, where ?? {});
		return docs.length;
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

	private validateData(data: Record<string, unknown>, isUpdate: boolean): FieldValidationError[] {
		const errors: FieldValidationError[] = [];
		const fields = this.collectionConfig.fields;

		for (const field of fields) {
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

			// Run custom validator if present
			if (field.validate && value !== undefined) {
				const result = field.validate(value, { data, req: {} });
				// ValidateFunction returns string (error message) or true (valid)
				if (typeof result === 'string') {
					errors.push({
						field: field.name,
						message: result,
					});
				}
				// Note: if result is a Promise, we'd need async validation
				// For now, we only handle synchronous validators
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
		if (!hooks || hooks.length === 0) {
			return docs;
		}

		const processedDocs: T[] = [];

		for (const doc of docs) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
			let processedDoc = doc as Record<string, unknown>;

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

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Record<string, unknown> is compatible with T
			processedDocs.push(processedDoc as T);
		}

		return processedDocs;
	}

	private async runDeleteHooks(
		hookType: 'beforeDelete' | 'afterDelete',
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
				operation: 'delete',
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
	FindOptions,
	FindResult,
	DeleteResult,
	WhereClause,
	FieldValidationError,
} from './momentum-api.types';

export {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	ValidationError,
} from './momentum-api.types';
