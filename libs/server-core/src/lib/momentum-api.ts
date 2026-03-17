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
} from '@momentumcms/core';
import { createLogger } from '@momentumcms/logger';
import {
	flattenDataFields,
	validateFieldConstraints,
	getSoftDeleteField,
	hasVersionDrafts,
} from '@momentumcms/core';
import type { DocumentStatus } from '@momentumcms/core';
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
	DraftNotVisibleError,
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
 * import { initializeMomentumAPI } from '@momentumcms/server-core';
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
// Deep Equality Helper
// ============================================

/**
 * Recursively compares two values for structural equality.
 * Used by matchesDefaultWhereConstraints to support non-primitive constraint values
 * (arrays, objects) that would fail with strict === reference equality.
 */
function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (typeof a !== 'object' || typeof b !== 'object') return false;

	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		return a.every((item, i) => deepEqual(item, b[i]));
	}

	if (Array.isArray(b)) return false;

	// Both a and b are non-null, non-array objects at this point
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;

	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed to non-null object, indexing by string key
	const aRec = a as Record<string, unknown>;
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed to non-null object, indexing by string key
	const bRec = b as Record<string, unknown>;
	return aKeys.every(
		(key) => Object.prototype.hasOwnProperty.call(bRec, key) && deepEqual(aRec[key], bRec[key]),
	);
}

// ============================================
// Where Clause Helpers
// ============================================

/**
 * Flattens a structured WhereClause into simple key-value pairs for the adapter.
 * Converts { field: { equals: value } } to { field: value }.
 * Direct values like { field: value } are passed through unchanged.
 */
/**
 * Strip transient keys (prefixed with _) from data before DB persistence.
 * Hooks use _-prefixed keys for inter-hook communication (e.g., _file for upload buffers).
 */
function stripTransientKeys(data: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (!key.startsWith('_')) {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Maps user-facing where clause operator names to `$`-prefixed internal names
 * consumed by database adapters. The `equals` operator is handled separately
 * (it unwraps to a direct value).
 */
const OPERATOR_MAP: Record<string, string> = {
	equals: '$eq',
	gt: '$gt',
	gte: '$gte',
	lt: '$lt',
	lte: '$lte',
	not_equals: '$ne',
	like: '$like',
	contains: '$contains',
	in: '$in',
	not_in: '$nin',
	exists: '$exists',
};

/** Maximum number of field conditions allowed in a single where clause (counted globally across main + joins). */
const MAX_WHERE_CONDITIONS = 20;

/** Maximum number of relationship JOIN sub-queries allowed per request. */
const MAX_JOINS = 5;

/** All valid user-facing operator names. */
const VALID_OPERATORS = new Set(Object.keys(OPERATOR_MAP));

/**
 * Recursively count all field conditions in a where clause tree,
 * including those nested inside and/or arrays.
 */
function countWhereConditions(where: WhereClause, depth = 0): number {
	if (depth > MAX_WHERE_NESTING_DEPTH) {
		throw new ValidationError([
			{
				field: 'where',
				message: `Where clause nesting depth exceeds maximum of ${MAX_WHERE_NESTING_DEPTH} levels.`,
			},
		]);
	}

	let count = 0;
	for (const [key, value] of Object.entries(where)) {
		if ((key === 'and' || key === 'or') && Array.isArray(value)) {
			for (const sub of value) {
				if (typeof sub === 'object' && sub !== null) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WhereClause sub-object
					count += countWhereConditions(sub as WhereClause, depth + 1);
				}
			}
		} else {
			count++;
		}
	}
	return count;
}

function flattenWhereClause(where: WhereClause | undefined): Record<string, unknown> {
	if (!where) return {};

	// Guard: limit total number of conditions (counted recursively) to prevent expensive queries
	const fieldCount = countWhereConditions(where);
	if (fieldCount > MAX_WHERE_CONDITIONS) {
		throw new ValidationError([
			{
				field: 'where',
				message: `Where clause exceeds maximum of ${MAX_WHERE_CONDITIONS} conditions (got ${fieldCount}).`,
			},
		]);
	}

	return flattenWhereRecursive(where, 0);
}

/** Maximum nesting depth for and/or logical operators. */
const MAX_WHERE_NESTING_DEPTH = 5;

function flattenWhereRecursive(where: WhereClause, depth: number): Record<string, unknown> {
	if (depth > MAX_WHERE_NESTING_DEPTH) {
		throw new ValidationError([
			{
				field: 'where',
				message: `Where clause nesting depth exceeds maximum of ${MAX_WHERE_NESTING_DEPTH} levels.`,
			},
		]);
	}

	const result: Record<string, unknown> = {};
	for (const [field, condition] of Object.entries(where)) {
		// Handle and/or logical operators
		if (field === 'and' || field === 'or') {
			if (!Array.isArray(condition)) {
				throw new ValidationError([
					{
						field,
						message: `The "${field}" operator requires an array of conditions.`,
					},
				]);
			}
			const internalKey = field === 'and' ? '$and' : '$or';
			result[internalKey] = condition
				.filter((sub: unknown): sub is WhereClause => typeof sub === 'object' && sub !== null)
				.map((sub: WhereClause) => flattenWhereRecursive(sub, depth + 1));
			continue;
		}

		if (typeof condition !== 'object' || condition === null) {
			result[field] = condition;
			continue;
		}
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Where clause operator object
		const condObj = condition as Record<string, unknown>;

		// Convert user-facing operators to $-prefixed form for DB adapters
		const ops: Record<string, unknown> = {};
		let hasOp = false;
		for (const [userOp, internalOp] of Object.entries(OPERATOR_MAP)) {
			if (userOp in condObj) {
				ops[internalOp] = condObj[userOp];
				hasOp = true;
			}
		}

		// Reject unknown operators
		for (const key of Object.keys(condObj)) {
			if (!VALID_OPERATORS.has(key)) {
				throw new ValidationError([
					{
						field,
						message: `Unknown operator "${key}". Valid operators: ${[...VALID_OPERATORS].sort().join(', ')}`,
					},
				]);
			}
		}

		if (hasOp) {
			result[field] = ops;
		} else {
			result[field] = condition;
		}
	}
	return result;
}

/** Represents a JOIN requirement extracted from a relationship where clause. */
interface JoinSpec {
	targetTable: string;
	localField: string;
	targetField: string;
	conditions: Record<string, unknown>;
	/** Raw sub-where clause (before flattening) for access control validation. */
	rawWhere: WhereClause;
}

/**
 * Extracts relationship sub-queries from a where clause, converting them into JOIN specs.
 * Relationship sub-queries are detected when a relationship field's condition contains
 * keys that are NOT valid operators (i.e., they reference fields on the related collection).
 *
 * Returns cleaned where clause (without relationship sub-queries) and join specs.
 */
function extractRelationshipJoins(
	where: WhereClause | undefined,
	fields: Field[],
	allCollections: CollectionConfig[],
): { cleanedWhere: WhereClause | undefined; joins: JoinSpec[] } {
	if (!where) return { cleanedWhere: undefined, joins: [] };

	const dataFields = flattenDataFields(fields);
	const fieldMap = new Map(dataFields.map((f) => [f.name, f]));
	const joins: JoinSpec[] = [];
	const cleanedWhere: WhereClause = {};

	for (const [key, condition] of Object.entries(where)) {
		// Recurse into and/or arrays to extract relationship JOINs from nested conditions
		if (key === 'and' || key === 'or') {
			if (Array.isArray(condition)) {
				const cleanedArray: WhereClause[] = [];
				for (const sub of condition) {
					if (typeof sub === 'object' && sub !== null) {
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WhereClause sub-object
						const { cleanedWhere: subCleaned, joins: subJoins } = extractRelationshipJoins(
							sub as WhereClause,
							fields,
							allCollections,
						);
						if (subCleaned) cleanedArray.push(subCleaned);
						joins.push(...subJoins);
					}
				}
				if (cleanedArray.length > 0) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WhereClause passthrough
					(cleanedWhere as Record<string, unknown>)[key] = cleanedArray;
				}
			}
			continue;
		}

		const field = fieldMap.get(key);
		if (
			!field ||
			field.type !== 'relationship' ||
			typeof condition !== 'object' ||
			condition === null
		) {
			cleanedWhere[key] = condition;
			continue;
		}

		// Check if condition keys are sub-field references (not valid operators)
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- condition is already verified as object above
		const condObj = condition as Record<string, unknown>;
		const condKeys = Object.keys(condObj);
		const hasNonOperatorKeys = condKeys.some((k) => !VALID_OPERATORS.has(k));

		if (!hasNonOperatorKeys) {
			// All keys are valid operators → this is an operator query on the ID column
			cleanedWhere[key] = condition;
			continue;
		}

		// This is a relationship sub-query → extract as a JOIN
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- relationship field
		const relField = field as import('@momentumcms/core').RelationshipField;
		let targetSlug: string | undefined;
		try {
			const targetConfig = relField.collection();
			if (targetConfig && typeof targetConfig === 'object' && 'slug' in targetConfig) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- lazy ref returns unknown, guarded by 'slug' in check
				targetSlug = (targetConfig as CollectionConfig).slug;
			}
		} catch {
			// Ignore lazy reference errors
		}

		if (!targetSlug) {
			throw new ValidationError([
				{
					field: key,
					message: `Cannot resolve target collection for relationship field "${key}".`,
				},
			]);
		}

		// Verify target collection exists
		const targetCollection = allCollections.find((c) => c.slug === targetSlug);
		if (!targetCollection) {
			throw new ValidationError([
				{
					field: key,
					message: `Target collection "${targetSlug}" not found for relationship field "${key}".`,
				},
			]);
		}

		// Flatten the sub-conditions using the standard operator mapping
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WhereClause sub-object
		const subWhere = condition as WhereClause;
		const flattenedConditions = flattenWhereClause(subWhere);

		const targetTable = targetCollection.dbName ?? targetCollection.slug;
		joins.push({
			targetTable,
			localField: key,
			targetField: 'id',
			conditions: flattenedConditions,
			rawWhere: subWhere,
		});
	}

	return {
		cleanedWhere: Object.keys(cleanedWhere).length > 0 ? cleanedWhere : undefined,
		joins,
	};
}

/**
 * Validate that the user has read access to all fields referenced in the where clause.
 * Prevents information leakage by blocking queries on restricted fields.
 */
async function validateWhereFields(
	where: WhereClause | undefined,
	fields: Field[],
	req: RequestContext,
): Promise<void> {
	if (!where) return;
	const dataFields = flattenDataFields(fields);
	const fieldMap = new Map(dataFields.map((f) => [f.name, f]));

	for (const fieldName of Object.keys(where)) {
		if (fieldName === 'and' || fieldName === 'or') {
			const subs = where[fieldName];
			if (Array.isArray(subs)) {
				for (const sub of subs) {
					if (typeof sub === 'object' && sub !== null) {
						// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WhereClause sub-object
						await validateWhereFields(sub as WhereClause, fields, req);
					}
				}
			}
			continue;
		}
		const field = fieldMap.get(fieldName);
		if (!field?.access?.read) continue;
		const allowed = await Promise.resolve(field.access.read({ req }));
		if (!allowed) {
			throw new AccessDeniedError('read', fieldName);
		}
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
		private readonly allCollections: CollectionConfig[] = [],
	) {}

	async find(options: FindOptions = {}): Promise<FindResult<T>> {
		// Check read access
		await this.checkAccess('read');

		// Validate field-level access in where clause (prevent information leakage)
		if (!this.context.overrideAccess) {
			await validateWhereFields(
				options.where,
				this.collectionConfig.fields,
				this.buildRequestContext(),
			);
		}

		// Run beforeRead hooks
		await this.runBeforeReadHooks();

		// Prepare query options (strip depth and where — they need special handling)
		const limit = options.limit ?? 10;
		const page = options.page ?? 1;
		const { depth: _depth, where, withDeleted: _wd, onlyDeleted: _od, ...queryOptions } = options;

		// Extract relationship sub-queries into JOIN specs before flattening
		const { cleanedWhere, joins } = extractRelationshipJoins(
			where,
			this.collectionConfig.fields,
			this.allCollections,
		);

		// Enforce join limit
		if (joins.length > MAX_JOINS) {
			throw new ValidationError([
				{
					field: 'where',
					message: `Number of relationship joins (${joins.length}) exceeds maximum of ${MAX_JOINS}.`,
				},
			]);
		}

		// Enforce global condition count (main where + all join sub-queries combined)
		const mainCount = cleanedWhere ? countWhereConditions(cleanedWhere) : 0;
		const joinCount = joins.reduce(
			(sum, j) => sum + countWhereConditions(j.rawWhere),
			0,
		);
		const totalConditions = mainCount + joinCount;
		if (totalConditions > MAX_WHERE_CONDITIONS) {
			throw new ValidationError([
				{
					field: 'where',
					message: `Where clause exceeds maximum of ${MAX_WHERE_CONDITIONS} conditions (got ${totalConditions} across main query and ${joins.length} join(s)).`,
				},
			]);
		}

		// Validate field-level access on target collections referenced by JOINs
		if (!this.context.overrideAccess) {
			for (const join of joins) {
				const targetCol = this.allCollections.find(
					(c) => (c.dbName ?? c.slug) === join.targetTable,
				);
				if (targetCol) {
					await validateWhereFields(join.rawWhere, targetCol.fields, this.buildRequestContext());
				}
			}
		}

		const whereParams = flattenWhereClause(cleanedWhere);

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

		// Draft visibility: only users with readDrafts access see drafts
		if (hasVersionDrafts(this.collectionConfig) && !this.context.overrideAccess) {
			const canSeeDrafts = await this.canReadDrafts();
			if (!canSeeDrafts) {
				whereParams['_status'] = 'published';
			}
		}

		const query: Record<string, unknown> = {
			...queryOptions,
			...whereParams,
			limit,
			page,
		};

		// Attach relationship JOIN specs for the adapter (strip rawWhere — only needed for access validation)
		if (joins.length > 0) {
			query['$joins'] = joins.map(({ rawWhere: _rw, ...rest }) => rest);
		}

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
		if (joins.length > 0) {
			countQuery['$joins'] = joins.map(({ rawWhere: _rw, ...rest }) => rest);
		}
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

	async findById(id: string, options?: { depth?: number; withDeleted?: boolean }): Promise<T> {
		// Check read access
		await this.checkAccess('read', id);

		// Run beforeRead hooks
		await this.runBeforeReadHooks();

		// Execute query
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Adapter returns Record<string, unknown> | null, safe cast to T | null
		const doc = (await this.adapter.findById(this.slug, id)) as T | null;

		if (!doc) {
			throw new DocumentNotFoundError(this.slug, id);
		}

		// Filter out soft-deleted documents unless explicitly requested
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (
			softDeleteField &&
			!options?.withDeleted &&
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
			(doc as Record<string, unknown>)[softDeleteField]
		) {
			// Soft-deleted docs appear as "not found" to prevent information leakage
			throw new DocumentNotFoundError(this.slug, id);
		}

		// Draft visibility: only users with readDrafts access see drafts
		if (hasVersionDrafts(this.collectionConfig) && !this.context.overrideAccess) {
			const canSeeDrafts = await this.canReadDrafts();
			if (!canSeeDrafts) {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
				const record = doc as Record<string, unknown>;
				if (record['_status'] !== 'published') {
					// Throw DraftNotVisibleError (→ 200 with doc: null) instead of
					// DocumentNotFoundError (→ 404) so the API doesn't falsely claim
					// the resource is missing while still hiding draft content.
					throw new DraftNotVisibleError(this.slug, id);
				}
			}
		}

		// Filter by defaultWhere constraints (e.g., user-scoped filtering)
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- T is compatible with Record<string, unknown>
		if (!this.matchesDefaultWhereConstraints(doc as Record<string, unknown>)) {
			// Scoped docs appear as "not found" to prevent information leakage
			throw new DocumentNotFoundError(this.slug, id);
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

		// Strip transient properties (prefixed with _) before DB insert —
		// hooks use them for inter-hook communication (e.g., _file for upload buffers)
		processedData = stripTransientKeys(processedData);

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

		// Enforce defaultWhere constraints (e.g., user-scoped filtering)
		if (!this.matchesDefaultWhereConstraints(originalDoc)) {
			throw new DocumentNotFoundError(this.slug, id);
		}

		// Auto-create version snapshot of previous state for versioned collections
		if (hasVersionDrafts(this.collectionConfig) && this.adapter.createVersion) {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- _status is a known string field
			const status = (originalDoc['_status'] as DocumentStatus) ?? 'draft';
			await this.adapter.createVersion(this.slug, id, originalDoc, { status });

			// Enforce maxPerDoc limit
			const versionsConfig = this.collectionConfig.versions;
			const maxPerDoc =
				typeof versionsConfig === 'object' && versionsConfig !== null
					? versionsConfig.maxPerDoc
					: undefined;
			if (maxPerDoc && this.adapter.deleteVersions) {
				await this.adapter.deleteVersions(this.slug, id, maxPerDoc);
			}
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

		// Strip transient properties (prefixed with _) before DB update
		processedData = stripTransientKeys(processedData);

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

		// Enforce defaultWhere constraints (e.g., user-scoped filtering)
		if (!this.matchesDefaultWhereConstraints(doc)) {
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

		// Enforce defaultWhere constraints (e.g., user-scoped filtering)
		if (!this.matchesDefaultWhereConstraints(doc)) {
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

		// Validate field-level access in where clause
		if (!this.context.overrideAccess) {
			await validateWhereFields(where, this.collectionConfig.fields, this.buildRequestContext());
		}

		// Use find with where clause and count results
		// Pass limit: 0 to signal we want all matching docs for counting
		const { cleanedWhere, joins } = extractRelationshipJoins(
			where,
			this.collectionConfig.fields,
			this.allCollections,
		);
		const whereParams = flattenWhereClause(cleanedWhere);

		// Inject soft-delete filter
		const softDeleteField = getSoftDeleteField(this.collectionConfig);
		if (softDeleteField && !options?.withDeleted) {
			whereParams[softDeleteField] = null;
		}

		const query: Record<string, unknown> = { ...whereParams, limit: 0 };
		if (joins.length > 0) {
			query['$joins'] = joins.map(({ rawWhere: _rw, ...rest }) => rest);
		}
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

	/**
	 * Checks whether a document satisfies the collection's defaultWhere constraints.
	 * Returns false if the document is outside the current user's scope.
	 */
	private matchesDefaultWhereConstraints(doc: Record<string, unknown>): boolean {
		if (!this.collectionConfig.defaultWhere) return true;
		const constraints = this.collectionConfig.defaultWhere(this.buildRequestContext());
		if (!constraints) return true;
		for (const [key, value] of Object.entries(constraints)) {
			if (!deepEqual(doc[key], value)) return false;
		}
		return true;
	}

	private async checkAccess(
		operation: 'create' | 'read' | 'update' | 'delete',
		id?: string,
		data?: Record<string, unknown>,
	): Promise<void> {
		if (this.context.overrideAccess) {
			return;
		}

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

	/**
	 * Check if the current user can see draft documents (non-throwing).
	 * Uses `access.readDrafts` if configured, otherwise falls back to `access.update`.
	 */
	private async canReadDrafts(): Promise<boolean> {
		if (!this.context.user) return false;

		// 1. Use explicit readDrafts access if configured
		const readDraftsFn = this.collectionConfig.access?.readDrafts;
		if (readDraftsFn) {
			try {
				return !!(await Promise.resolve(readDraftsFn({ req: this.buildRequestContext() })));
			} catch {
				return false;
			}
		}

		// 2. Fallback: check update access
		const updateFn = this.collectionConfig.access?.update;
		if (!updateFn) return true; // No access control = allow
		try {
			return !!(await Promise.resolve(updateFn({ req: this.buildRequestContext() })));
		} catch {
			return false;
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
	DraftNotVisibleError,
	AccessDeniedError,
	GlobalNotFoundError,
	ValidationError,
} from './momentum-api.types';

export { ReferentialIntegrityError } from '@momentumcms/core';
