/**
 * Where Clause Processing
 *
 * Handles flattening, validation, and relationship JOIN extraction for where clauses.
 * Converts user-facing operator names to internal $-prefixed format consumed by DB adapters.
 */

import type { CollectionConfig, Field, RequestContext } from '@momentumcms/core';
import { flattenDataFields } from '@momentumcms/core';
import type { WhereClause } from './momentum-api.types';
import { AccessDeniedError, ValidationError } from './momentum-api.types';

// ============================================
// Constants
// ============================================

/**
 * Maps user-facing where clause operator names to `$`-prefixed internal names
 * consumed by database adapters.
 */
export const OPERATOR_MAP: Record<string, string> = {
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
export const MAX_WHERE_CONDITIONS = 20;

/** Maximum number of relationship JOIN sub-queries allowed per request. */
export const MAX_JOINS = 5;

/** Maximum nesting depth for and/or logical operators. */
export const MAX_WHERE_NESTING_DEPTH = 5;

/** Maximum number of results per page. */
export const MAX_PAGE_LIMIT = 1000;

/** Maximum page number. Prevents offset overflow: page * limit must stay within safe integer range. */
export const MAX_PAGE = 1_000_000;

/** All valid user-facing operator names. */
export const VALID_OPERATORS = new Set(Object.keys(OPERATOR_MAP));

// ============================================
// Types
// ============================================

/** Represents a JOIN requirement extracted from a relationship where clause. */
export interface JoinSpec {
	targetTable: string;
	localField: string;
	targetField: string;
	conditions: Record<string, unknown>;
	/** Raw sub-where clause (before flattening) for access control validation. */
	rawWhere: WhereClause;
}

// ============================================
// Condition Counting
// ============================================

/**
 * Recursively count all field conditions in a where clause tree,
 * including those nested inside and/or arrays.
 */
export function countWhereConditions(where: WhereClause, depth = 0): number {
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

// ============================================
// Where Clause Flattening
// ============================================

/**
 * Flattens a structured WhereClause into simple key-value pairs for the adapter.
 * Converts { field: { equals: value } } to { field: { $eq: value } }.
 * Guards against excessive conditions and nesting depth.
 */
export function flattenWhereClause(where: WhereClause | undefined): Record<string, unknown> {
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
				.map((sub: WhereClause) => {
					// Pass through $join markers — they are inline relationship join specs
					if ('$join' in sub) return sub;
					return flattenWhereRecursive(sub, depth + 1);
				});
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
				let value = condObj[userOp];
				// Coerce string "true"/"false" to boolean for $exists (query-string origin)
				if (internalOp === '$exists' && typeof value === 'string') {
					value = value === 'true';
				}
				// Strip null bytes from string values — they crash Postgres UTF-8 encoding
				if (typeof value === 'string') {
					value = value.replace(/\0/g, '');
				}
				// Strip null bytes from $in/$nin array string items
				if (Array.isArray(value)) {
					value = value.map((item: unknown) =>
						typeof item === 'string' ? item.replace(/\0/g, '') : item,
					);
				}
				ops[internalOp] = value;
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

// ============================================
// Relationship JOIN Extraction
// ============================================

/**
 * Extracts relationship sub-queries from a where clause, converting them into JOIN specs.
 * Relationship sub-queries are detected when a relationship field's condition contains
 * keys that are NOT valid operators (i.e., they reference fields on the related collection).
 *
 * Returns cleaned where clause (without relationship sub-queries) and join specs.
 */
export function extractRelationshipJoins(
	where: WhereClause | undefined,
	fields: Field[],
	allCollections: CollectionConfig[],
): { cleanedWhere: WhereClause | undefined; joins: JoinSpec[]; allJoins: JoinSpec[] } {
	if (!where) return { cleanedWhere: undefined, joins: [], allJoins: [] };

	const dataFields = flattenDataFields(fields);
	const fieldMap = new Map(dataFields.map((f) => [f.name, f]));
	const joins: JoinSpec[] = []; // top-level joins only (become $joins on the query)
	const allJoins: JoinSpec[] = []; // all joins including inline (for limit enforcement + access validation)
	const cleanedWhere: WhereClause = {};

	for (const [key, condition] of Object.entries(where)) {
		// Recurse into and/or arrays — relationship JOINs stay inline to preserve logical context
		if (key === 'and' || key === 'or') {
			if (Array.isArray(condition)) {
				const cleanedArray: WhereClause[] = [];
				for (const sub of condition) {
					if (typeof sub === 'object' && sub !== null) {
						const {
							cleanedWhere: subCleaned,
							joins: subTopJoins,
							allJoins: subAllJoins,
						} = extractRelationshipJoins(
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WhereClause sub-object
							sub as WhereClause,
							fields,
							allCollections,
						);
						if (subCleaned) cleanedArray.push(subCleaned);
						// Keep joins inline: inject $join markers into the sub-clause
						// so they stay within the or/and group instead of being promoted to top-level AND
						for (const join of subTopJoins) {
							// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- $join marker is an internal format not representable by WhereClause
							cleanedArray.push({ ['$join']: join } as unknown as WhereClause);
						}
						// Collect into allJoins for limit enforcement + access validation
						allJoins.push(...subAllJoins);
					}
				}
				if (cleanedArray.length > 0) {
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- WhereClause passthrough
					(cleanedWhere as Record<string, unknown>)[key] = cleanedArray;
				}
			}
			continue;
		}

		let field = fieldMap.get(key);

		// Handle dot-notation relationship keys like "category.name" from Express qs
		// Split into field ("category") and sub-field path ("name"), then reconstruct
		// as a nested relationship sub-query: { category: { name: condition } }
		if (!field && key.includes('.')) {
			const [rootKey, ...subPath] = key.split('.');
			const rootField = fieldMap.get(rootKey);
			if (
				rootField &&
				rootField.type === 'relationship' &&
				subPath.length > 0 &&
				condition !== null
			) {
				// Reconstruct as nested: { name: { equals: "test" } } → sub-query on the relationship
				let nested: unknown = condition;
				for (let i = subPath.length - 1; i >= 0; i--) {
					nested = { [subPath[i]]: nested };
				}
				field = rootField;
				// Replace key/condition with the root field and nested sub-query
				// Re-process this entry as a relationship sub-query
				const {
					cleanedWhere: subCleaned,
					joins: subJoins,
					allJoins: subAllJoins,
				} = extractRelationshipJoins(
					// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- reconstructed nested where
					{ [rootKey]: nested } as WhereClause,
					fields,
					allCollections,
				);
				if (subCleaned) Object.assign(cleanedWhere, subCleaned);
				joins.push(...subJoins);
				allJoins.push(...subAllJoins);
				continue;
			}
		}

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
		const hasOperatorKeys = condKeys.some((k) => VALID_OPERATORS.has(k));
		const hasNonOperatorKeys = condKeys.some((k) => !VALID_OPERATORS.has(k));

		if (hasOperatorKeys && hasNonOperatorKeys) {
			// Ambiguous: mixing FK operators (e.g. equals) with sub-field references (e.g. name)
			throw new ValidationError([
				{
					field: key,
					message: `Cannot mix operators and sub-field references on relationship field "${key}". Use either operators (e.g. { equals: 'id' }) or sub-field queries (e.g. { name: { equals: 'value' } }), not both.`,
				},
			]);
		}

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
		const joinSpec: JoinSpec = {
			targetTable,
			localField: key,
			targetField: 'id',
			conditions: flattenedConditions,
			rawWhere: subWhere,
		};
		joins.push(joinSpec);
		allJoins.push(joinSpec);
	}

	return {
		cleanedWhere: Object.keys(cleanedWhere).length > 0 ? cleanedWhere : undefined,
		joins,
		allJoins,
	};
}

// ============================================
// Field Access Validation
// ============================================

/**
 * System fields auto-generated by Drizzle for every collection.
 * These are always queryable and not subject to field-level access control.
 */
const SYSTEM_QUERYABLE_FIELDS = new Set(['id', 'createdAt', 'updatedAt', '_status']);

/**
 * Validate that the user has read access to all fields referenced in the where clause.
 * Prevents information leakage by blocking queries on restricted fields.
 */
export async function validateWhereFields(
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
		// Support dot-notation: "metadata.color" → base field "metadata"
		const baseName = fieldName.includes('.') ? fieldName.split('.')[0] : fieldName;
		// System fields (id, createdAt, updatedAt, _status) are always queryable
		if (SYSTEM_QUERYABLE_FIELDS.has(baseName)) continue;
		const field = fieldMap.get(baseName);
		if (!field) {
			throw new ValidationError([{ field: fieldName, message: `Unknown field: ${baseName}` }]);
		}
		if (!field.access?.read) continue;
		const allowed = await Promise.resolve(field.access.read({ req }));
		if (!allowed) {
			throw new AccessDeniedError('read', baseName);
		}
	}
}

/**
 * Validate that the user has read access to the field used for sorting.
 * Prevents information inference through result ordering of restricted fields.
 */
export async function validateSortField(
	sort: string | undefined,
	fields: Field[],
	req: RequestContext,
): Promise<void> {
	if (!sort) return;
	// Strip leading '-' for descending sort
	const fieldName = sort.startsWith('-') ? sort.slice(1) : sort;
	const baseName = fieldName.includes('.') ? fieldName.split('.')[0] : fieldName;
	const dataFields = flattenDataFields(fields);
	const field = dataFields.find((f) => f.name === baseName);
	if (!field?.access?.read) return;
	const allowed = await Promise.resolve(field.access.read({ req }));
	if (!allowed) {
		throw new AccessDeniedError('read', baseName);
	}
}
