import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeMomentumAPI, resetMomentumAPI, DocumentNotFoundError } from './momentum-api';
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

	describe('pagination input sanitization', () => {
		it('should clamp negative page to 1', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({ page: -5, limit: 10 });

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['page']).toBe(1);
		});

		it('should clamp negative limit to 1', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({ limit: -10 });

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['limit']).toBe(1);
		});

		it('should clamp limit exceeding MAX_PAGE_LIMIT to 1000', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({ limit: 99999 });

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['limit']).toBe(1000);
		});

		it('should treat NaN limit as default 10', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({ limit: NaN });

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['limit']).toBe(10);
		});

		it('should treat Infinity page as default 1', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').find({ page: Infinity });

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['page']).toBe(1);
		});
	});

	describe('pagination extreme values', () => {
		it('should clamp page=1e308 to MAX_PAGE instead of crashing', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const result = await api.collection('posts').find({ page: 1e308, limit: 10 });
			expect(result).toBeDefined();
			expect(result.docs).toEqual([]);

			// page passed to adapter should be clamped, not 1e308
			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['page']).toBeLessThanOrEqual(1_000_000);
			expect(Number.isFinite(query['page'])).toBe(true);
		});

		it('should clamp page=Infinity to a safe value', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const result = await api.collection('posts').find({ page: Infinity, limit: 10 });
			expect(result).toBeDefined();

			const query = vi.mocked(mockAdapter.find).mock.calls[0][1] as Record<string, unknown>;
			expect(query['page']).toBeLessThanOrEqual(1_000_000);
			expect(Number.isFinite(query['page'])).toBe(true);
		});
	});

	describe('batch delete with invalid IDs', () => {
		it('should throw DocumentNotFoundError for non-existent IDs like __proto__', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			await expect(
				api.collection('posts').batchDelete(['__proto__', 'constructor', 'prototype']),
			).rejects.toThrow(DocumentNotFoundError);
		});
	});

	describe('search() must filter restricted fields from results', () => {
		const restrictedSearchCollection: CollectionConfig = {
			slug: 'secure-items',
			labels: { singular: 'Secure Item', plural: 'Secure Items' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'secret',
					type: 'text',
					access: { read: () => false },
				},
			],
		};

		let restrictedSearchConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			restrictedSearchConfig = {
				collections: [restrictedSearchCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should strip restricted fields from search results (adapter.find fallback)', async () => {
			const api = initializeMomentumAPI(restrictedSearchConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([
				{ id: '1', title: 'hello', secret: 'HIDDEN-VALUE' },
			]);

			const result = await api.collection('secure-items').search('hello');

			expect(result.docs).toHaveLength(1);
			expect(result.docs[0]).toHaveProperty('title', 'hello');
			expect(result.docs[0]).not.toHaveProperty('secret');
		});

		it('should strip restricted fields from search results (adapter.search path)', async () => {
			const searchAdapter = {
				...mockAdapter,
				search: vi.fn().mockResolvedValue([{ id: '1', title: 'hello', secret: 'HIDDEN-VALUE' }]),
			};
			const searchConfig: MomentumConfig = {
				collections: [restrictedSearchCollection],
				db: { adapter: searchAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(searchConfig);

			const result = await api.collection('secure-items').search('hello');

			expect(result.docs).toHaveLength(1);
			expect(result.docs[0]).toHaveProperty('title', 'hello');
			expect(result.docs[0]).not.toHaveProperty('secret');
		});
	});

	describe('sort field validation against field-level read access', () => {
		const restrictedSortCollection: CollectionConfig = {
			slug: 'secure-items',
			labels: { singular: 'Secure Item', plural: 'Secure Items' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{
					name: 'secret',
					type: 'text',
					access: { read: () => false },
				},
			],
		};

		let restrictedSortConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			restrictedSortConfig = {
				collections: [restrictedSortCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should throw when sorting by a field with access.read = false', async () => {
			const api = initializeMomentumAPI(restrictedSortConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(api.collection('secure-items').find({ sort: 'secret' })).rejects.toThrow(
				/access denied/i,
			);
		});

		it('should throw when sorting descending by a restricted field', async () => {
			const api = initializeMomentumAPI(restrictedSortConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(api.collection('secure-items').find({ sort: '-secret' })).rejects.toThrow(
				/access denied/i,
			);
		});

		it('should allow sorting by unrestricted fields', async () => {
			const api = initializeMomentumAPI(restrictedSortConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(api.collection('secure-items').find({ sort: 'title' })).resolves.toBeDefined();
		});

		it('should skip sort validation when overrideAccess is true', async () => {
			const api = initializeMomentumAPI(restrictedSortConfig);
			const overrideApi = api.setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				overrideApi.collection('secure-items').find({ sort: 'secret' }),
			).resolves.toBeDefined();
		});
	});
});
