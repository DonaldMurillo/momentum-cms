import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeMomentumAPI, resetMomentumAPI } from './momentum-api';
import type { CollectionConfig, MomentumConfig, DatabaseAdapter } from '@momentumcms/core';
import {
	mockPostsCollection,
	mockUsersCollection,
	mockCollectionWithHooks,
} from './__tests__/test-fixtures';

describe('MomentumAPI', () => {
	let mockAdapter: DatabaseAdapter;
	let config: MomentumConfig;

	beforeEach(() => {
		resetMomentumAPI();

		mockAdapter = {
			find: vi.fn(),
			findById: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		};

		config = {
			collections: [mockPostsCollection, mockUsersCollection, mockCollectionWithHooks],
			db: { adapter: mockAdapter },
			server: { port: 4000 },
		};
	});

	afterEach(() => {
		resetMomentumAPI();
	});

	describe('where clause comparison operators', () => {
		it('should pass gte operator to the adapter as $gte', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { createdAt: { gte: '2024-01-01' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ createdAt: { $gte: '2024-01-01' } }),
			);
		});

		it('should pass lte operator to the adapter as $lte', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { createdAt: { lte: '2024-12-31' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ createdAt: { $lte: '2024-12-31' } }),
			);
		});

		it('should pass gt operator to the adapter as $gt', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { createdAt: { gt: '2024-01-01' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ createdAt: { $gt: '2024-01-01' } }),
			);
		});

		it('should pass lt operator to the adapter as $lt', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { createdAt: { lt: '2024-12-31' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ createdAt: { $lt: '2024-12-31' } }),
			);
		});

		it('should combine gte and lte into a single operator object', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { createdAt: { gte: '2024-01-01', lte: '2024-12-31' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					createdAt: { $gte: '2024-01-01', $lte: '2024-12-31' },
				}),
			);
		});

		it('should still handle equals operator', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { status: { equals: 'published' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ status: { $eq: 'published' } }),
			);
		});

		it('should handle plain value where clauses', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { status: 'published' },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ status: 'published' }),
			);
		});
	});

	describe('extended where clause operators', () => {
		it('should pass not_equals operator to the adapter as $ne', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { status: { not_equals: 'archived' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ status: { $ne: 'archived' } }),
			);
		});

		it('should pass like operator to the adapter as $like', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { title: { like: '%hello%' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ title: { $like: '%hello%' } }),
			);
		});

		it('should pass contains operator to the adapter as $contains', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { title: { contains: 'hello' } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ title: { $contains: 'hello' } }),
			);
		});

		it('should pass in operator to the adapter as $in', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { status: { in: ['draft', 'published'] } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ status: { $in: ['draft', 'published'] } }),
			);
		});

		it('should pass not_in operator to the adapter as $nin', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { status: { not_in: ['archived'] } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ status: { $nin: ['archived'] } }),
			);
		});

		it('should pass exists: true operator to the adapter as $exists', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { category: { exists: true } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ category: { $exists: true } }),
			);
		});

		it('should pass exists: false operator to the adapter as $exists', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { category: { exists: false } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ category: { $exists: false } }),
			);
		});

		it('should merge multiple operators on the same field', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { price: { gte: 10, lte: 100, not_equals: 50 } },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					price: { $gte: 10, $lte: 100, $ne: 50 },
				}),
			);
		});

		it('should pass or operator to adapter as $or with flattened conditions', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { or: [{ status: 'draft' }, { status: 'published' }] },
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					$or: [{ status: 'draft' }, { status: 'published' }],
				}),
			);
		});

		it('should pass and operator to adapter as $and with flattened conditions', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: {
					and: [{ title: { contains: 'hello' } }, { status: { not_equals: 'archived' } }],
				},
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					$and: [{ title: { $contains: 'hello' } }, { status: { $ne: 'archived' } }],
				}),
			);
		});

		it('should handle nested or inside and', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: {
					and: [
						{ or: [{ status: 'draft' }, { status: 'published' }] },
						{ title: { contains: 'hello' } },
					],
				},
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					$and: [
						{ $or: [{ status: 'draft' }, { status: 'published' }] },
						{ title: { $contains: 'hello' } },
					],
				}),
			);
		});

		it('should combine or/and with top-level field conditions', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: {
					title: { contains: 'hello' },
					or: [{ status: 'draft' }, { status: 'published' }],
				},
			});

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({
					title: { $contains: 'hello' },
					$or: [{ status: 'draft' }, { status: 'published' }],
				}),
			);
		});

		it('should throw when or/and nesting exceeds 5 levels', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// 6 levels deep
			const deepWhere = {
				or: [{ and: [{ or: [{ and: [{ or: [{ and: [{ title: 'x' }] }] }] }] }] }],
			};

			await expect(api.collection('posts').find({ where: deepWhere })).rejects.toThrow(
				/nesting.*depth|too deeply nested/i,
			);
		});

		it('should throw on unknown operator in where clause', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('posts').find({
					where: { title: { bogus: 'hello' } },
				}),
			).rejects.toThrow(/Unknown operator.*bogus/);
		});

		it('should list valid operators in unknown operator error message', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('posts').find({
					where: { title: { nope: 'x' } },
				}),
			).rejects.toThrow(/contains.*equals.*exists.*gt/);
		});

		it('should throw when where clause exceeds 20 field conditions', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const bigWhere: Record<string, unknown> = {};
			for (let i = 0; i < 21; i++) bigWhere[`field${i}`] = 'val';

			await expect(api.collection('posts').find({ where: bigWhere })).rejects.toThrow(
				/exceeds maximum of 20 conditions/,
			);
		});

		it('should allow up to 20 field conditions', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const where: Record<string, unknown> = {};
			for (let i = 0; i < 20; i++) where[`field${i}`] = 'val';

			await expect(api.collection('posts').find({ where })).resolves.toBeDefined();
		});

		it('should reject deeply nested where clause before stack overflow (DoS prevention)', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// Build 200 levels deep — zero leaf conditions, so countWhereConditions
			// would return 0 but recurse 200 times without a depth guard
			let where: Record<string, unknown> = { title: 'leaf' };
			for (let i = 0; i < 200; i++) {
				where = { or: [where] };
			}

			await expect(api.collection('posts').find({ where })).rejects.toThrow(/nesting.*depth/i);
		});

		it('should handle null elements in and/or arrays gracefully', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: {
					or: [{ title: { equals: 'hello' } }, null as unknown as Record<string, unknown>],
				},
			});

			const findCall = vi.mocked(mockAdapter.find).mock.calls[0];
			const query = findCall[1] as Record<string, unknown>;
			// null should be filtered out, leaving only the valid condition
			expect(query['$or']).toEqual([{ title: { $eq: 'hello' } }]);
		});

		it('should handle non-object elements in and/or arrays gracefully', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: {
					and: [
						{ title: { equals: 'test' } },
						'garbage' as unknown as Record<string, unknown>,
						42 as unknown as Record<string, unknown>,
					],
				},
			});

			const findCall = vi.mocked(mockAdapter.find).mock.calls[0];
			const query = findCall[1] as Record<string, unknown>;
			// Only the valid object condition should remain
			expect(query['$and']).toEqual([{ title: { $eq: 'test' } }]);
		});
	});

	describe('field access control in where clauses', () => {
		const restrictedCollection: CollectionConfig = {
			slug: 'secure-items',
			labels: { singular: 'Secure Item', plural: 'Secure Items' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{ name: 'email', type: 'email' },
				{
					name: 'secret',
					type: 'text',
					access: { read: () => false },
				},
				{
					name: 'internal_token',
					type: 'text',
					access: { read: () => false },
				},
			],
		};

		let restrictedConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			restrictedConfig = {
				collections: [restrictedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should throw when filtering by a field with access.read = false', async () => {
			const api = initializeMomentumAPI(restrictedConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secure-items').find({
					where: { secret: { equals: 'password123' } },
				}),
			).rejects.toThrow(/cannot filter|access denied/i);
		});

		it('should allow filtering by fields without access restrictions', async () => {
			const api = initializeMomentumAPI(restrictedConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secure-items').find({
					where: { name: { equals: 'test' } },
				}),
			).resolves.toBeDefined();
		});

		it('should throw when any field in mixed where has access.read = false', async () => {
			const api = initializeMomentumAPI(restrictedConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secure-items').find({
					where: { name: { equals: 'test' }, internal_token: { exists: true } },
				}),
			).rejects.toThrow(/cannot filter|access denied/i);
		});
	});

	describe('relationship where clause (JOIN queries)', () => {
		const categoriesCollection: CollectionConfig = {
			slug: 'categories',
			labels: { singular: 'Category', plural: 'Categories' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{ name: 'priority', type: 'number' },
			],
		};

		const articlesWithRelCollection: CollectionConfig = {
			slug: 'articles-rel',
			labels: { singular: 'Article', plural: 'Articles' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'category',
					type: 'relationship',
					collection: () => categoriesCollection,
				} as CollectionConfig['fields'][number],
			],
		};

		let relConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			relConfig = {
				collections: [categoriesCollection, articlesWithRelCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should pass $joins to the adapter when filtering by relationship sub-fields', async () => {
			const api = initializeMomentumAPI(relConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('articles-rel').find({
				where: { category: { name: { contains: 'Tech' } } },
			});

			const findCall = vi.mocked(mockAdapter.find).mock.calls[0];
			const query = findCall[1] as Record<string, unknown>;
			expect(query['$joins']).toBeDefined();
			expect(query['$joins']).toEqual([
				{
					targetTable: 'categories',
					localField: 'category',
					targetField: 'id',
					conditions: { name: { $contains: 'Tech' } },
				},
			]);
			// The relationship field should NOT appear as a direct where param
			expect(query['category']).toBeUndefined();
		});

		it('should combine relationship JOIN with normal field conditions', async () => {
			const api = initializeMomentumAPI(relConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('articles-rel').find({
				where: {
					title: { contains: 'hello' },
					category: { name: { equals: 'News' } },
				},
			});

			const findCall = vi.mocked(mockAdapter.find).mock.calls[0];
			const query = findCall[1] as Record<string, unknown>;
			// Normal field should be passed as usual
			expect(query['title']).toEqual({ $contains: 'hello' });
			// Relationship JOIN should be extracted
			expect(query['$joins']).toEqual([
				{
					targetTable: 'categories',
					localField: 'category',
					targetField: 'id',
					conditions: { name: { $eq: 'News' } },
				},
			]);
		});

		it('should still allow filtering by relationship ID directly (no JOIN needed)', async () => {
			const api = initializeMomentumAPI(relConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('articles-rel').find({
				where: { category: 'some-id' },
			});

			const findCall = vi.mocked(mockAdapter.find).mock.calls[0];
			const query = findCall[1] as Record<string, unknown>;
			// Direct ID value — no JOIN, just equality
			expect(query['category']).toBe('some-id');
			expect(query['$joins']).toBeUndefined();
		});

		it('should still allow filtering by relationship ID with operators (no JOIN needed)', async () => {
			const api = initializeMomentumAPI(relConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('articles-rel').find({
				where: { category: { in: ['id1', 'id2'] } },
			});

			const findCall = vi.mocked(mockAdapter.find).mock.calls[0];
			const query = findCall[1] as Record<string, unknown>;
			// Operator on relationship ID — no JOIN
			expect(query['category']).toEqual({ $in: ['id1', 'id2'] });
			expect(query['$joins']).toBeUndefined();
		});

		it('should reject relationship sub-query targeting access-restricted fields on the target collection', async () => {
			const categoriesWithSecret: CollectionConfig = {
				slug: 'categories',
				labels: { singular: 'Category', plural: 'Categories' },
				fields: [
					{ name: 'name', type: 'text', required: true },
					{ name: 'priority', type: 'number' },
					{
						name: 'internal_code',
						type: 'text',
						access: { read: () => false },
					},
				],
			};

			const articlesRel: CollectionConfig = {
				slug: 'articles-rel',
				labels: { singular: 'Article', plural: 'Articles' },
				fields: [
					{ name: 'title', type: 'text', required: true },
					{
						name: 'category',
						type: 'relationship',
						collection: () => categoriesWithSecret,
					} as CollectionConfig['fields'][number],
				],
			};

			resetMomentumAPI();
			const restrictedRelConfig: MomentumConfig = {
				collections: [categoriesWithSecret, articlesRel],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};

			const api = initializeMomentumAPI(restrictedRelConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// Attempt to filter by a restricted field on the target collection
			await expect(
				api.collection('articles-rel').find({
					where: { category: { internal_code: { equals: 'SECRET-123' } } },
				}),
			).rejects.toThrow(/cannot filter|access denied/i);
		});

		it('should allow relationship sub-query on unrestricted fields of the target collection', async () => {
			const api = initializeMomentumAPI(relConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// 'name' and 'priority' have no access restrictions on categoriesCollection
			await expect(
				api.collection('articles-rel').find({
					where: { category: { name: { contains: 'Tech' } } },
				}),
			).resolves.toBeDefined();
		});

		it('should handle dot-notation relationship keys from Express qs (e.g. "category.name")', async () => {
			const api = initializeMomentumAPI(relConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// Express qs parses ?where[category.name][equals]=test as { "category.name": { equals: "test" } }
			await api.collection('articles-rel').find({
				where: { 'category.name': { equals: 'test' } },
			});

			const findCall = vi.mocked(mockAdapter.find).mock.calls[0];
			const query = findCall[1] as Record<string, unknown>;
			// Should be decomposed into a proper relationship JOIN, not passed as raw dot-notation
			expect(query['$joins']).toBeDefined();
			expect(query['$joins']).toEqual([
				{
					targetTable: 'categories',
					localField: 'category',
					targetField: 'id',
					conditions: { name: { $eq: 'test' } },
				},
			]);
			// Raw dot-notation key should NOT appear
			expect(query['category.name']).toBeUndefined();
		});
	});

	describe('security: validateWhereFields recurses into and/or', () => {
		const restrictedCollection: CollectionConfig = {
			slug: 'secure-items',
			labels: { singular: 'Secure Item', plural: 'Secure Items' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{
					name: 'secret',
					type: 'text',
					access: { read: () => false },
				},
			],
		};

		let restrictedConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			restrictedConfig = {
				collections: [restrictedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should block restricted fields inside or conditions', async () => {
			const api = initializeMomentumAPI(restrictedConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secure-items').find({
					where: { or: [{ secret: { equals: 'guessedValue' } }] },
				}),
			).rejects.toThrow(/cannot filter|access denied/i);
		});

		it('should block restricted fields inside and conditions', async () => {
			const api = initializeMomentumAPI(restrictedConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secure-items').find({
					where: { and: [{ secret: { equals: 'password' } }] },
				}),
			).rejects.toThrow(/cannot filter|access denied/i);
		});

		it('should block restricted fields nested deeply in or/and', async () => {
			const api = initializeMomentumAPI(restrictedConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secure-items').find({
					where: {
						or: [{ and: [{ secret: { equals: 'deep-probe' } }] }],
					},
				}),
			).rejects.toThrow(/cannot filter|access denied/i);
		});

		it('should allow unrestricted fields inside or/and', async () => {
			const api = initializeMomentumAPI(restrictedConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secure-items').find({
					where: { or: [{ name: { equals: 'test' } }] },
				}),
			).resolves.toBeDefined();
		});
	});

	describe('security: recursive condition counting in where clauses', () => {
		it('should count conditions recursively inside or arrays', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// 21 conditions inside a single or array — should exceed limit of 20
			const conditions = Array.from({ length: 21 }, (_, i) => ({ [`field${i}`]: 'val' }));

			await expect(api.collection('posts').find({ where: { or: conditions } })).rejects.toThrow(
				/exceeds maximum of 20 conditions/,
			);
		});

		it('should count conditions recursively inside and arrays', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const conditions = Array.from({ length: 21 }, (_, i) => ({ [`field${i}`]: 'val' }));

			await expect(api.collection('posts').find({ where: { and: conditions } })).rejects.toThrow(
				/exceeds maximum of 20 conditions/,
			);
		});

		it('should count across nested or/and levels', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// 11 conditions at top + 11 inside or = 22 total
			const topFields: Record<string, unknown> = {};
			for (let i = 0; i < 11; i++) topFields[`top${i}`] = 'val';
			const orConditions = Array.from({ length: 11 }, (_, i) => ({ [`or${i}`]: 'val' }));

			await expect(
				api.collection('posts').find({
					where: { ...topFields, or: orConditions },
				}),
			).rejects.toThrow(/exceeds maximum of 20 conditions/);
		});

		it('should allow exactly 20 conditions split across or/and', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// 10 top-level + 10 inside or = 20 total
			const topFields: Record<string, unknown> = {};
			for (let i = 0; i < 10; i++) topFields[`top${i}`] = 'val';
			const orConditions = Array.from({ length: 10 }, (_, i) => ({ [`or${i}`]: 'val' }));

			await expect(
				api.collection('posts').find({
					where: { ...topFields, or: orConditions },
				}),
			).resolves.toBeDefined();
		});
	});

	describe('Issue #1: equals with sibling operators', () => {
		it('should not drop sibling operators when equals is combined with other operators', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { status: { equals: 'published', not_equals: 'archived' } },
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0]?.[1] as Record<string, unknown>;
			// equals + not_equals should both be present — equals should NOT silently eat not_equals
			expect(query['status']).toEqual({ $eq: 'published', $ne: 'archived' });
		});

		it('should reject or explicitly handle equals combined with range operators', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// This should either throw a ValidationError (ambiguous) or include both operators
			// Currently it silently drops gt — that's the bug
			await api.collection('posts').find({
				where: { createdAt: { equals: '2024-06-15', gt: '2024-01-01' } },
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0]?.[1] as Record<string, unknown>;
			// If equals coexists with gt, both should be mapped
			expect(query['createdAt']).toEqual({ $eq: '2024-06-15', $gt: '2024-01-01' });
		});
	});

	describe('Issue #2: relationship sub-queries inside and/or', () => {
		const categoriesCol: CollectionConfig = {
			slug: 'categories',
			labels: { singular: 'Category', plural: 'Categories' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{ name: 'priority', type: 'number' },
			],
		};

		const articlesRelCol: CollectionConfig = {
			slug: 'articles-rel',
			labels: { singular: 'Article', plural: 'Articles' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'category',
					type: 'relationship',
					collection: () => categoriesCol,
				} as CollectionConfig['fields'][number],
			],
		};

		it('should keep relationship JOINs inline within or arrays (not top-level $joins)', async () => {
			resetMomentumAPI();
			const relCfg: MomentumConfig = {
				collections: [categoriesCol, articlesRelCol],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(relCfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('articles-rel').find({
				where: { or: [{ category: { name: { contains: 'Tech' } } }] },
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0]?.[1] as Record<string, unknown>;
			// Relationship sub-query inside or should stay inline as $join marker, not top-level $joins
			expect(query['$joins']).toBeUndefined();
			expect(query['$or']).toBeDefined();
			const orArray = query['$or'] as Record<string, unknown>[];
			expect(orArray.some((c) => '$join' in c)).toBe(true);
		});

		it('should keep relationship JOINs inline within and arrays (not top-level $joins)', async () => {
			resetMomentumAPI();
			const relCfg: MomentumConfig = {
				collections: [categoriesCol, articlesRelCol],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(relCfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('articles-rel').find({
				where: {
					and: [{ title: { contains: 'hello' } }, { category: { name: { contains: 'Tech' } } }],
				},
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0]?.[1] as Record<string, unknown>;
			// Relationship sub-query inside and should stay inline as $join marker, not top-level $joins
			expect(query['$joins']).toBeUndefined();
			expect(query['$and']).toBeDefined();
			const andArray = query['$and'] as Record<string, unknown>[];
			expect(andArray.some((c) => '$join' in c)).toBe(true);
		});
	});

	describe('Issue: reject undeclared fields in where clauses', () => {
		it('should reject where clause fields that are not in the collection definition', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('posts').find({
					where: { nonExistentField: { equals: 'test' } },
				}),
			).rejects.toThrow(/unknown field/i);
		});

		it('should reject undeclared fields nested inside or conditions', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('posts').find({
					where: { or: [{ _status: { equals: 'draft' } }] },
				}),
			).rejects.toThrow(/unknown field/i);
		});

		it('should reject undeclared fields nested inside and conditions', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('posts').find({
					where: { and: [{ deletedAt: { equals: null } }] },
				}),
			).rejects.toThrow(/unknown field/i);
		});

		it('should still allow declared fields without access control', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('posts').find({
					where: { title: { equals: 'valid' } },
				}),
			).resolves.toBeDefined();
		});
	});

	describe('Issue #3: condition count bypass via relationship sub-queries', () => {
		const categoriesCol: CollectionConfig = {
			slug: 'categories',
			labels: { singular: 'Category', plural: 'Categories' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{ name: 'priority', type: 'number' },
			],
		};

		const articlesRelCol: CollectionConfig = {
			slug: 'articles-rel',
			labels: { singular: 'Article', plural: 'Articles' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'category',
					type: 'relationship',
					collection: () => categoriesCol,
				} as CollectionConfig['fields'][number],
				{
					name: 'category2',
					type: 'relationship',
					collection: () => categoriesCol,
				} as CollectionConfig['fields'][number],
			],
		};

		it('should enforce a global condition count across main query + all relationship sub-queries', async () => {
			resetMomentumAPI();
			const relCfg: MomentumConfig = {
				collections: [categoriesCol, articlesRelCol],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(relCfg).setContext({ overrideAccess: true });

			// 19 top-level conditions (title repeated doesn't help — use or to add bulk)
			// + 1 relationship sub-query with 2 sub-conditions = 21 total > 20
			// Use or array to create lots of conditions
			const orConditions = Array.from({ length: 19 }, (_, i) => ({
				[`title`]: `val${i}`,
			}));

			await expect(
				api.collection('articles-rel').find({
					where: {
						or: orConditions,
						category: { name: { contains: 'a' }, priority: { gt: 1 } },
					},
				}),
			).rejects.toThrow(/exceeds maximum/i);
		});

		it('should limit the number of relationship joins', async () => {
			resetMomentumAPI();

			// Create a collection with many relationship fields
			const manyRelFields: CollectionConfig['fields'] = [
				{ name: 'title', type: 'text', required: true },
			];
			for (let i = 0; i < 10; i++) {
				manyRelFields.push({
					name: `rel${i}`,
					type: 'relationship',
					collection: () => categoriesCol,
				} as CollectionConfig['fields'][number]);
			}

			const manyRelCol: CollectionConfig = {
				slug: 'many-rels',
				labels: { singular: 'ManyRel', plural: 'ManyRels' },
				fields: manyRelFields,
			};

			const relCfg: MomentumConfig = {
				collections: [categoriesCol, manyRelCol],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(relCfg);

			// Build a where with 10 relationship sub-queries
			const where: Record<string, unknown> = {};
			for (let i = 0; i < 10; i++) {
				where[`rel${i}`] = { name: { contains: 'test' } };
			}

			await expect(api.collection('many-rels').find({ where })).rejects.toThrow(
				/joins|relationships|maximum/i,
			);
		});
	});

	describe('count() must enforce the same where-clause limits as find()', () => {
		const categoriesCol: CollectionConfig = {
			slug: 'categories',
			labels: { singular: 'Category', plural: 'Categories' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{ name: 'priority', type: 'number' },
			],
		};

		const articlesRelCol: CollectionConfig = {
			slug: 'articles-rel',
			labels: { singular: 'Article', plural: 'Articles' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'category',
					type: 'relationship',
					collection: () => categoriesCol,
				} as CollectionConfig['fields'][number],
				{
					name: 'category2',
					type: 'relationship',
					collection: () => categoriesCol,
				} as CollectionConfig['fields'][number],
			],
		};

		it('should enforce MAX_JOINS in count()', async () => {
			resetMomentumAPI();

			const manyRelFields: CollectionConfig['fields'] = [
				{ name: 'title', type: 'text', required: true },
			];
			for (let i = 0; i < 10; i++) {
				manyRelFields.push({
					name: `rel${i}`,
					type: 'relationship',
					collection: () => categoriesCol,
				} as CollectionConfig['fields'][number]);
			}

			const manyRelCol: CollectionConfig = {
				slug: 'many-rels',
				labels: { singular: 'ManyRel', plural: 'ManyRels' },
				fields: manyRelFields,
			};

			const relCfg: MomentumConfig = {
				collections: [categoriesCol, manyRelCol],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(relCfg).setContext({ overrideAccess: true });

			const where: Record<string, unknown> = {};
			for (let i = 0; i < 10; i++) {
				where[`rel${i}`] = { name: { contains: 'test' } };
			}

			await expect(api.collection('many-rels').count(where)).rejects.toThrow(
				/joins|relationships|maximum/i,
			);
		});

		it('should enforce global condition count across main query + joins in count()', async () => {
			resetMomentumAPI();
			const relCfg: MomentumConfig = {
				collections: [categoriesCol, articlesRelCol],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(relCfg).setContext({ overrideAccess: true });

			// 19 top-level conditions + 1 relationship sub-query with 2 sub-conditions = 21 > 20
			const orConditions = Array.from({ length: 19 }, (_, i) => ({
				[`title`]: `val${i}`,
			}));

			await expect(
				api.collection('articles-rel').count({
					or: orConditions,
					category: { name: { contains: 'a' }, priority: { gt: 1 } },
				}),
			).rejects.toThrow(/exceeds maximum/i);
		});

		it('should validate field-level access on join target collections in count()', async () => {
			resetMomentumAPI();
			const relCfg: MomentumConfig = {
				collections: [categoriesCol, articlesRelCol],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			// NOT overriding access — field-level validation should fire
			const api = initializeMomentumAPI(relCfg);

			// Use a non-existent field on the join target to trigger validateWhereFields
			await expect(
				api.collection('articles-rel').count({
					category: { nonExistentField: { equals: 'x' } },
				}),
			).rejects.toThrow(/not allowed|unknown|invalid/i);
		});
	});

	describe('Issue #4: dot-notation where clauses on JSON/group fields', () => {
		const jsonCollection: CollectionConfig = {
			slug: 'products',
			labels: { singular: 'Product', plural: 'Products' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{ name: 'metadata', type: 'json', label: 'Metadata' },
			],
		};

		const restrictedJsonCollection: CollectionConfig = {
			slug: 'secrets',
			labels: { singular: 'Secret', plural: 'Secrets' },
			fields: [
				{ name: 'label', type: 'text' },
				{
					name: 'data',
					type: 'json',
					label: 'Data',
					access: { read: () => false },
				},
			],
		};

		it('should allow dot-notation where clause on json fields', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [jsonCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('products').find({
					where: { 'metadata.color': { equals: 'blue' } },
				}),
			).resolves.toBeDefined();
		});

		it('should allow multi-level dot-notation where clause', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [jsonCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('products').find({
					where: { 'metadata.dimensions.width': { gte: 10 } },
				}),
			).resolves.toBeDefined();
		});

		it('should reject dot-notation when the base field does not exist', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [jsonCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('products').find({
					where: { 'nonexistent.color': { equals: 'blue' } },
				}),
			).rejects.toThrow(/unknown field/i);
		});

		it('should enforce field-level access on dot-notation fields', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [restrictedJsonCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('secrets').find({
					where: { 'data.key': { equals: 'value' } },
				}),
			).rejects.toThrow(/access denied/i);
		});
	});

	describe('Issue #1: relationship joins inside or groups must preserve OR semantics', () => {
		const tagsCollection: CollectionConfig = {
			slug: 'tags',
			labels: { singular: 'Tag', plural: 'Tags' },
			fields: [{ name: 'label', type: 'text', required: true }],
		};

		const postsWithTagCollection: CollectionConfig = {
			slug: 'posts-tagged',
			labels: { singular: 'Post', plural: 'Posts' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'tag',
					type: 'relationship',
					collection: () => tagsCollection,
				} as CollectionConfig['fields'][number],
			],
		};

		it('should place relationship JOIN inside $or — not as a top-level AND', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [tagsCollection, postsWithTagCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts-tagged').find({
				where: { or: [{ title: { equals: 'Hello' } }, { tag: { label: { equals: 'news' } } }] },
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0]?.[1] as Record<string, unknown>;

			// The $or should contain BOTH conditions — the title filter AND the relationship join
			// The relationship join must NOT be extracted to a top-level $joins AND
			expect(query['$or']).toBeDefined();
			const orArray = query['$or'] as Record<string, unknown>[];
			expect(orArray).toHaveLength(2);

			// One sub-clause should be the title condition
			const titleClause = orArray.find((c) => 'title' in c);
			expect(titleClause).toBeDefined();

			// The other should contain the relationship join (either inline or as a $joins marker)
			// The key point: the join must NOT appear at top-level query['$joins']
			// because that would make it AND instead of OR
			expect(query['$joins']).toBeUndefined();
		});

		it('should preserve AND semantics when relationship join is inside and group', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [tagsCollection, postsWithTagCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts-tagged').find({
				where: {
					and: [{ title: { equals: 'Hello' } }, { tag: { label: { equals: 'news' } } }],
				},
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0]?.[1] as Record<string, unknown>;

			// For AND, top-level $joins is acceptable (AND is the default combinator),
			// but only if the non-join conditions are preserved in $and
			expect(query['$and']).toBeDefined();
		});
	});

	describe('Issue #3: mixed operator + sub-field keys on relationship must error', () => {
		const authorsCollection: CollectionConfig = {
			slug: 'authors',
			labels: { singular: 'Author', plural: 'Authors' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{ name: 'email', type: 'email' },
			],
		};

		const postsWithAuthorCollection: CollectionConfig = {
			slug: 'posts-authored',
			labels: { singular: 'Post', plural: 'Posts' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'author',
					type: 'relationship',
					collection: () => authorsCollection,
				} as CollectionConfig['fields'][number],
			],
		};

		it('should reject where clause that mixes operators and sub-field references', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [authorsCollection, postsWithAuthorCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// Mixing FK operator (equals) with sub-field reference (name) is ambiguous
			await expect(
				api.collection('posts-authored').find({
					where: { author: { equals: 'author-id-1', name: 'John' } },
				}),
			).rejects.toThrow(/cannot mix|ambiguous/i);
		});

		it('should accept pure operator queries on relationship field', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [authorsCollection, postsWithAuthorCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// Pure operator query on FK column — should work fine
			await expect(
				api.collection('posts-authored').find({
					where: { author: { equals: 'author-id-1' } },
				}),
			).resolves.toBeDefined();
		});

		it('should accept pure sub-field queries on relationship field', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [authorsCollection, postsWithAuthorCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// Pure sub-field reference — should produce a JOIN
			await expect(
				api.collection('posts-authored').find({
					where: { author: { name: { equals: 'John' } } },
				}),
			).resolves.toBeDefined();
		});
	});

	describe('exists operator string coercion', () => {
		it('should coerce string "true" to boolean true for exists operator', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { content: { exists: 'true' as unknown as boolean } },
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['content']).toEqual({ $exists: true });
		});

		it('should coerce string "false" to boolean false for exists operator', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({
				where: { content: { exists: 'false' as unknown as boolean } },
			});

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['content']).toEqual({ $exists: false });
		});
	});

	describe('__proto__ in where clause', () => {
		it('should silently ignore __proto__ in where clause (not enumerable)', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// __proto__ is not enumerable via Object.entries, so it's silently dropped
			// This test verifies it doesn't cause errors or reach the adapter
			const result = await api.collection('posts').find({
				where: { __proto__: { equals: 'test' } },
			});
			expect(result).toBeDefined();

			// Verify __proto__ was NOT passed through to the adapter
			const callArgs = vi.mocked(mockAdapter.find).mock.calls[0];
			const whereArg = callArgs[1];
			expect(whereArg).not.toHaveProperty('__proto__', { $eq: 'test' });
		});

		it('should reject constructor as a where clause field', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('posts').find({
					where: { constructor: { equals: 'test' } },
				}),
			).rejects.toThrow(/unknown field/i);
		});
	});

	describe('null byte sanitization in where values', () => {
		it('should strip null bytes from string values in where clause', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// Should not crash — null bytes stripped before reaching adapter
			const result = await api.collection('posts').find({
				where: { title: { equals: 'Tech\x00nology' } },
			});
			expect(result).toBeDefined();

			const callArgs = vi.mocked(mockAdapter.find).mock.calls[0];
			const whereArg = callArgs[1];
			// The null byte should be stripped from the value
			const titleClause = whereArg?.title ?? whereArg?.['title'];
			expect(titleClause).toBeDefined();
			expect(typeof titleClause).toBe('object');

			const eqVal = (titleClause as Record<string, unknown>)['$eq'];
			expect(eqVal).not.toContain('\x00');
		});

		it('should strip null bytes from contains/like pattern values', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const result = await api.collection('posts').find({
				where: { title: { contains: 'test\x00inject' } },
			});
			expect(result).toBeDefined();

			const callArgs = vi.mocked(mockAdapter.find).mock.calls[0];
			const whereArg = callArgs[1];
			const titleClause = whereArg?.title ?? whereArg?.['title'];
			expect(titleClause).toBeDefined();
			expect(typeof titleClause).toBe('object');

			const containsVal = (titleClause as Record<string, unknown>)['$contains'];
			expect(containsVal).not.toContain('\x00');
		});
	});
});
