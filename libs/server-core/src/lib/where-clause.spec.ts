import { describe, it, expect } from 'vitest';
import {
	countWhereConditions,
	flattenWhereClause,
	extractRelationshipJoins,
	validateWhereFields,
	validateSortField,
	OPERATOR_MAP,
	VALID_OPERATORS,
	MAX_WHERE_CONDITIONS,
	MAX_JOINS,
	MAX_WHERE_NESTING_DEPTH,
	MAX_PAGE_LIMIT,
	MAX_PAGE,
} from './where-clause';
import { ValidationError, AccessDeniedError } from './momentum-api.types';
import type { CollectionConfig, Field, RequestContext } from '@momentumcms/core';

describe('where-clause', () => {
	// ============================================
	// Constants
	// ============================================

	describe('constants', () => {
		it('should export expected security limits', () => {
			expect(MAX_WHERE_CONDITIONS).toBe(20);
			expect(MAX_JOINS).toBe(5);
			expect(MAX_WHERE_NESTING_DEPTH).toBe(5);
			expect(MAX_PAGE_LIMIT).toBe(1000);
			expect(MAX_PAGE).toBe(1_000_000);
		});

		it('should have VALID_OPERATORS derived from OPERATOR_MAP keys', () => {
			for (const key of Object.keys(OPERATOR_MAP)) {
				expect(VALID_OPERATORS.has(key)).toBe(true);
			}
			expect(VALID_OPERATORS.size).toBe(Object.keys(OPERATOR_MAP).length);
		});

		it('should map all expected user-facing operators', () => {
			expect(OPERATOR_MAP['equals']).toBe('$eq');
			expect(OPERATOR_MAP['not_equals']).toBe('$ne');
			expect(OPERATOR_MAP['gt']).toBe('$gt');
			expect(OPERATOR_MAP['gte']).toBe('$gte');
			expect(OPERATOR_MAP['lt']).toBe('$lt');
			expect(OPERATOR_MAP['lte']).toBe('$lte');
			expect(OPERATOR_MAP['like']).toBe('$like');
			expect(OPERATOR_MAP['contains']).toBe('$contains');
			expect(OPERATOR_MAP['in']).toBe('$in');
			expect(OPERATOR_MAP['not_in']).toBe('$nin');
			expect(OPERATOR_MAP['exists']).toBe('$exists');
		});
	});

	// ============================================
	// countWhereConditions
	// ============================================

	describe('countWhereConditions', () => {
		it('should count simple field conditions', () => {
			expect(countWhereConditions({ title: 'test', status: 'draft' })).toBe(2);
		});

		it('should count a single condition', () => {
			expect(countWhereConditions({ title: 'test' })).toBe(1);
		});

		it('should recurse into and arrays', () => {
			expect(
				countWhereConditions({
					and: [{ title: 'test' }, { status: 'draft' }],
				}),
			).toBe(2);
		});

		it('should recurse into or arrays', () => {
			expect(
				countWhereConditions({
					or: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
				}),
			).toBe(3);
		});

		it('should count nested and/or conditions', () => {
			expect(
				countWhereConditions({
					and: [{ or: [{ a: 1 }, { b: 2 }] }, { c: 3 }],
				}),
			).toBe(3);
		});

		it('should skip non-object items in and/or arrays', () => {
			expect(
				countWhereConditions({
					and: [{ title: 'test' }, null as unknown as Record<string, unknown>],
				}),
			).toBe(1);
		});

		it('should throw ValidationError when nesting depth exceeds maximum', () => {
			// Build deeply nested where: { and: [{ and: [{ and: [... depth > 5 ...] }] }] }
			let where: Record<string, unknown> = { field: 'value' };
			for (let i = 0; i < MAX_WHERE_NESTING_DEPTH + 1; i++) {
				where = { and: [where] };
			}
			expect(() => countWhereConditions(where)).toThrow(ValidationError);
			expect(() => countWhereConditions(where)).toThrow(/nesting depth/i);
		});
	});

	// ============================================
	// flattenWhereClause
	// ============================================

	describe('flattenWhereClause', () => {
		it('should return empty object for undefined', () => {
			expect(flattenWhereClause(undefined)).toEqual({});
		});

		it('should pass through direct values', () => {
			expect(flattenWhereClause({ title: 'test' })).toEqual({ title: 'test' });
		});

		it('should convert user-facing operators to $-prefixed', () => {
			const result = flattenWhereClause({ title: { equals: 'test' } });
			expect(result).toEqual({ title: { $eq: 'test' } });
		});

		it('should convert multiple operators on same field', () => {
			const result = flattenWhereClause({ age: { gte: 18, lt: 65 } });
			expect(result).toEqual({ age: { $gte: 18, $lt: 65 } });
		});

		it('should convert and/or to $and/$or', () => {
			const result = flattenWhereClause({
				or: [{ title: { equals: 'a' } }, { title: { equals: 'b' } }],
			});
			expect(result).toEqual({
				$or: [{ title: { $eq: 'a' } }, { title: { $eq: 'b' } }],
			});
		});

		it('should throw when and/or is not an array', () => {
			expect(() =>
				flattenWhereClause({
					and: 'not-an-array' as unknown as Record<string, unknown>[],
				}),
			).toThrow(ValidationError);
			expect(() =>
				flattenWhereClause({
					and: 'not-an-array' as unknown as Record<string, unknown>[],
				}),
			).toThrow(/requires an array/);
		});

		it('should throw when total conditions exceed maximum', () => {
			const where: Record<string, unknown> = {};
			for (let i = 0; i < MAX_WHERE_CONDITIONS + 1; i++) {
				where[`field${i}`] = 'value';
			}
			expect(() => flattenWhereClause(where)).toThrow(ValidationError);
			expect(() => flattenWhereClause(where)).toThrow(/exceeds maximum/);
		});

		it('should coerce string "true"/"false" to boolean for $exists', () => {
			const result = flattenWhereClause({ title: { exists: 'true' as unknown as boolean } });
			expect(result).toEqual({ title: { $exists: true } });

			const result2 = flattenWhereClause({ title: { exists: 'false' as unknown as boolean } });
			expect(result2).toEqual({ title: { $exists: false } });
		});

		it('should strip null bytes from string values', () => {
			const result = flattenWhereClause({ title: { equals: 'hello\x00world' } });

			const titleOps = result['title'] as Record<string, unknown>;
			expect(titleOps['$eq']).toBe('helloworld');
		});

		it('should strip null bytes from array items in $in/$nin', () => {
			const result = flattenWhereClause({ status: { in: ['a\x00b', 'c\x00d'] } });

			const statusOps = result['status'] as Record<string, unknown>;
			expect(statusOps['$in']).toEqual(['ab', 'cd']);
		});

		it('should reject unknown operators', () => {
			expect(() => flattenWhereClause({ title: { badOp: 'test' } })).toThrow(ValidationError);
			expect(() => flattenWhereClause({ title: { badOp: 'test' } })).toThrow(
				/Unknown operator "badOp"/,
			);
		});

		it('should pass through non-null non-object condition (e.g. null, number)', () => {
			expect(flattenWhereClause({ deletedAt: null })).toEqual({ deletedAt: null });
			expect(flattenWhereClause({ count: 5 })).toEqual({ count: 5 });
		});

		it('should pass through object condition with no recognized operators', () => {
			// An object where all keys are valid operators but none match any OPERATOR_MAP entry
			// This shouldn't happen in practice, but the else branch at line ~211 handles it
			// Actually — any unknown key would throw. So the else branch fires when hasOp is false
			// AND all keys pass VALID_OPERATORS check... which can't happen since the keys are checked.
			// The passthrough is for when condition is an object but has NO keys matching OPERATOR_MAP
			// AND no unknown keys — i.e., an empty object.
			const result = flattenWhereClause({ field: {} });
			expect(result).toEqual({ field: {} });
		});

		it('should pass through $join markers in and/or arrays', () => {
			const joinMarker = {
				$join: { targetTable: 'categories', localField: 'cat', targetField: 'id', conditions: {} },
			};
			const result = flattenWhereClause({
				and: [{ title: { equals: 'test' } }, joinMarker as unknown as Record<string, unknown>],
			});

			const andArr = result['$and'] as unknown[];
			expect(andArr).toHaveLength(2);
			expect(andArr[1]).toBe(joinMarker); // passed through unchanged
		});

		it('should throw when nesting depth exceeds maximum', () => {
			let where: Record<string, unknown> = { field: { equals: 'val' } };
			for (let i = 0; i < MAX_WHERE_NESTING_DEPTH + 1; i++) {
				where = { and: [where] };
			}
			expect(() => flattenWhereClause(where)).toThrow(ValidationError);
			expect(() => flattenWhereClause(where)).toThrow(/nesting depth/);
		});
	});

	// ============================================
	// extractRelationshipJoins
	// ============================================

	describe('extractRelationshipJoins', () => {
		const categoriesCollection: CollectionConfig = {
			slug: 'categories',
			labels: { singular: 'Category', plural: 'Categories' },
			fields: [{ name: 'name', type: 'text', required: true }],
		};

		const postsFields: Field[] = [
			{ name: 'title', type: 'text', required: true },
			{ name: 'content', type: 'textarea' },
			{
				name: 'category',
				type: 'relationship',
				collection: () => categoriesCollection,
			},
		];

		const allCollections = [
			{
				slug: 'posts',
				labels: { singular: 'Post', plural: 'Posts' },
				fields: postsFields,
			},
			categoriesCollection,
		];

		it('should return empty result for undefined where', () => {
			const result = extractRelationshipJoins(undefined, postsFields, allCollections);
			expect(result).toEqual({ cleanedWhere: undefined, joins: [], allJoins: [] });
		});

		it('should pass through non-relationship field conditions', () => {
			const result = extractRelationshipJoins(
				{ title: { equals: 'test' } },
				postsFields,
				allCollections,
			);
			expect(result.cleanedWhere).toEqual({ title: { equals: 'test' } });
			expect(result.joins).toHaveLength(0);
		});

		it('should pass through operator queries on relationship fields (FK by ID)', () => {
			const result = extractRelationshipJoins(
				{ category: { equals: 'cat-123' } },
				postsFields,
				allCollections,
			);
			expect(result.cleanedWhere).toEqual({ category: { equals: 'cat-123' } });
			expect(result.joins).toHaveLength(0);
		});

		it('should extract relationship sub-queries as JOIN specs', () => {
			const result = extractRelationshipJoins(
				{ category: { name: { equals: 'Tech' } } },
				postsFields,
				allCollections,
			);
			expect(result.cleanedWhere).toBeUndefined();
			expect(result.joins).toHaveLength(1);
			expect(result.joins[0].targetTable).toBe('categories');
			expect(result.joins[0].localField).toBe('category');
			expect(result.joins[0].targetField).toBe('id');
			expect(result.joins[0].conditions).toEqual({ name: { $eq: 'Tech' } });
		});

		it('should handle dot-notation relationship keys', () => {
			const result = extractRelationshipJoins(
				{ 'category.name': { equals: 'Tech' } },
				postsFields,
				allCollections,
			);
			expect(result.joins).toHaveLength(1);
			expect(result.joins[0].targetTable).toBe('categories');
		});

		it('should throw when mixing operators and sub-field references', () => {
			expect(() =>
				extractRelationshipJoins(
					{ category: { equals: 'id', name: { equals: 'Tech' } } },
					postsFields,
					allCollections,
				),
			).toThrow(ValidationError);
			expect(() =>
				extractRelationshipJoins(
					{ category: { equals: 'id', name: { equals: 'Tech' } } },
					postsFields,
					allCollections,
				),
			).toThrow(/Cannot mix operators/);
		});

		it('should throw when relationship target collection cannot be resolved', () => {
			const fieldsWithBrokenRef: Field[] = [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'broken',
					type: 'relationship',
					collection: () => {
						throw new Error('lazy ref broken');
					},
				},
			];

			expect(() =>
				extractRelationshipJoins(
					{ broken: { name: { equals: 'x' } } },
					fieldsWithBrokenRef,
					allCollections,
				),
			).toThrow(ValidationError);
			expect(() =>
				extractRelationshipJoins(
					{ broken: { name: { equals: 'x' } } },
					fieldsWithBrokenRef,
					allCollections,
				),
			).toThrow(/Cannot resolve target collection/);
		});

		it('should throw when target collection is not in allCollections', () => {
			const orphanCollection: CollectionConfig = {
				slug: 'orphans',
				labels: { singular: 'Orphan', plural: 'Orphans' },
				fields: [{ name: 'name', type: 'text' }],
			};
			const fieldsWithOrphanRef: Field[] = [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'orphan',
					type: 'relationship',
					collection: () => orphanCollection,
				},
			];

			// allCollections does NOT include 'orphans'
			expect(() =>
				extractRelationshipJoins(
					{ orphan: { name: { equals: 'x' } } },
					fieldsWithOrphanRef,
					allCollections,
				),
			).toThrow(ValidationError);
			expect(() =>
				extractRelationshipJoins(
					{ orphan: { name: { equals: 'x' } } },
					fieldsWithOrphanRef,
					allCollections,
				),
			).toThrow(/not found/);
		});

		it('should recurse into and/or arrays and keep joins inline', () => {
			const result = extractRelationshipJoins(
				{
					or: [{ category: { name: { equals: 'Tech' } } }, { title: { equals: 'Fallback' } }],
				},
				postsFields,
				allCollections,
			);

			// The relationship JOIN should be inlined as a $join marker in the or array
			expect(result.allJoins).toHaveLength(1);
			expect(result.cleanedWhere).toBeDefined();
		});

		it('should pass through non-relationship conditions in dot-notation that are not relationship fields', () => {
			// "title.sub" where "title" is a text field, not a relationship
			const result = extractRelationshipJoins(
				{ 'title.sub': { equals: 'test' } },
				postsFields,
				allCollections,
			);
			// Should be passed through as-is since 'title' is not a relationship
			expect(result.cleanedWhere).toEqual({ 'title.sub': { equals: 'test' } });
			expect(result.joins).toHaveLength(0);
		});

		it('should handle non-object/null condition on relationship field', () => {
			const result = extractRelationshipJoins({ category: null }, postsFields, allCollections);
			expect(result.cleanedWhere).toEqual({ category: null });
			expect(result.joins).toHaveLength(0);
		});

		it('should use dbName for target table when available', () => {
			const customDbNameCollection: CollectionConfig = {
				slug: 'categories',
				dbName: 'custom_categories_table',
				labels: { singular: 'Category', plural: 'Categories' },
				fields: [{ name: 'name', type: 'text' }],
			};
			const collections = [
				{ slug: 'posts', labels: { singular: 'Post', plural: 'Posts' }, fields: postsFields },
				customDbNameCollection,
			];

			const result = extractRelationshipJoins(
				{ category: { name: { equals: 'Tech' } } },
				postsFields,
				collections,
			);
			expect(result.joins[0].targetTable).toBe('custom_categories_table');
		});
	});

	// ============================================
	// validateWhereFields
	// ============================================

	describe('validateWhereFields', () => {
		const fieldsWithAccess: Field[] = [
			{ name: 'title', type: 'text', required: true },
			{
				name: 'secret',
				type: 'text',
				access: { read: () => false },
			},
			{
				name: 'visible',
				type: 'text',
				access: { read: () => true },
			},
		];

		const mockReq = {} as RequestContext;

		it('should resolve for undefined where', async () => {
			await expect(
				validateWhereFields(undefined, fieldsWithAccess, mockReq),
			).resolves.toBeUndefined();
		});

		it('should resolve when querying unrestricted fields', async () => {
			await expect(
				validateWhereFields({ title: { equals: 'test' } }, fieldsWithAccess, mockReq),
			).resolves.toBeUndefined();
		});

		it('should resolve when querying field with read: true', async () => {
			await expect(
				validateWhereFields({ visible: { equals: 'test' } }, fieldsWithAccess, mockReq),
			).resolves.toBeUndefined();
		});

		it('should throw AccessDeniedError when querying restricted field', async () => {
			await expect(
				validateWhereFields({ secret: { equals: 'test' } }, fieldsWithAccess, mockReq),
			).rejects.toThrow(AccessDeniedError);
		});

		it('should throw ValidationError for unknown fields', async () => {
			await expect(
				validateWhereFields({ nonexistent: { equals: 'test' } }, fieldsWithAccess, mockReq),
			).rejects.toThrow(ValidationError);
		});

		it('should recurse into and/or arrays', async () => {
			await expect(
				validateWhereFields({ or: [{ secret: { equals: 'test' } }] }, fieldsWithAccess, mockReq),
			).rejects.toThrow(AccessDeniedError);
		});

		it('should handle dot-notation field names', async () => {
			// "secret.sub" → base field is "secret" which has read: false
			await expect(
				validateWhereFields({ 'secret.sub': { equals: 'test' } }, fieldsWithAccess, mockReq),
			).rejects.toThrow(AccessDeniedError);
		});
	});

	// ============================================
	// validateSortField
	// ============================================

	describe('validateSortField', () => {
		const fieldsWithAccess: Field[] = [
			{ name: 'title', type: 'text', required: true },
			{
				name: 'secret',
				type: 'text',
				access: { read: () => false },
			},
		];

		const mockReq = {} as RequestContext;

		it('should resolve for undefined sort', async () => {
			await expect(
				validateSortField(undefined, fieldsWithAccess, mockReq),
			).resolves.toBeUndefined();
		});

		it('should resolve for unrestricted field', async () => {
			await expect(validateSortField('title', fieldsWithAccess, mockReq)).resolves.toBeUndefined();
		});

		it('should throw for restricted field', async () => {
			await expect(validateSortField('secret', fieldsWithAccess, mockReq)).rejects.toThrow(
				AccessDeniedError,
			);
		});

		it('should strip leading - for descending sort', async () => {
			await expect(validateSortField('-secret', fieldsWithAccess, mockReq)).rejects.toThrow(
				AccessDeniedError,
			);
		});

		it('should handle dot-notation sort fields', async () => {
			await expect(validateSortField('secret.nested', fieldsWithAccess, mockReq)).rejects.toThrow(
				AccessDeniedError,
			);
		});

		it('should resolve for field without access control', async () => {
			await expect(validateSortField('title', fieldsWithAccess, mockReq)).resolves.toBeUndefined();
		});

		it('should resolve for unknown field (no access config to check)', async () => {
			// Field not found in dataFields means no access.read to check
			await expect(
				validateSortField('unknown', fieldsWithAccess, mockReq),
			).resolves.toBeUndefined();
		});
	});
});
