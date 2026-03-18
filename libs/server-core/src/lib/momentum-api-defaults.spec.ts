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

	describe('defaultWhere constraints', () => {
		const scopedCollection: CollectionConfig = {
			slug: 'notes',
			fields: [
				{ name: 'title', type: 'text', required: true },
				{ name: 'ownerId', type: 'text' },
			],
			defaultWhere: (req) => (req.user ? { ownerId: req.user.id } : undefined),
		};

		let scopedConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			scopedConfig = {
				collections: [scopedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should inject defaultWhere constraints into find queries', async () => {
			const api = initializeMomentumAPI(scopedConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await authApi.collection('notes').find();

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'notes',
				expect.objectContaining({ ownerId: 'user-42' }),
			);
		});

		it('should throw DocumentNotFoundError when doc does not match defaultWhere (string constraint)', async () => {
			const api = initializeMomentumAPI(scopedConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });
			// Doc belongs to a different user
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Secret',
				ownerId: 'user-99',
			});

			await expect(authApi.collection('notes').findById('1')).rejects.toThrow(
				DocumentNotFoundError,
			);
		});

		it('should allow findById when doc matches defaultWhere (string constraint)', async () => {
			const api = initializeMomentumAPI(scopedConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'My Note',
				ownerId: 'user-42',
			});

			const result = await authApi.collection('notes').findById('1');

			expect(result).toBeDefined();
			expect(result?.title).toBe('My Note');
		});

		it('should reject update when doc does not match defaultWhere', async () => {
			const api = initializeMomentumAPI(scopedConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Not Mine',
				ownerId: 'user-99',
			});

			await expect(authApi.collection('notes').update('1', { title: 'Hijacked' })).rejects.toThrow(
				DocumentNotFoundError,
			);
		});

		it('should reject delete when doc does not match defaultWhere', async () => {
			const api = initializeMomentumAPI(scopedConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Not Mine',
				ownerId: 'user-99',
			});

			await expect(authApi.collection('notes').delete('1')).rejects.toThrow(DocumentNotFoundError);
		});

		it('should match defaultWhere with array constraint values (deep equality)', async () => {
			// This tests that non-primitive constraint values work correctly.
			// Current code uses strict ===, which fails for arrays/objects.
			const arrayConstraintCollection: CollectionConfig = {
				slug: 'tagged-items',
				fields: [
					{ name: 'title', type: 'text', required: true },
					{ name: 'tags', type: 'json' },
				],
				defaultWhere: () => ({ tags: ['public', 'featured'] }),
			};

			resetMomentumAPI();
			const arrayConfig: MomentumConfig = {
				collections: [arrayConstraintCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(arrayConfig);

			// Doc has the exact same array value, but it's a different reference
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Tagged Item',
				tags: ['public', 'featured'],
			});

			const result = await api.collection('tagged-items').findById('1');

			// With strict ===, this would return null because ['a','b'] !== ['a','b']
			// With deep equality, this should return the doc
			expect(result).toBeDefined();
			expect(result?.title).toBe('Tagged Item');
		});

		it('should match defaultWhere with object constraint values (deep equality)', async () => {
			const objectConstraintCollection: CollectionConfig = {
				slug: 'structured-items',
				fields: [
					{ name: 'title', type: 'text', required: true },
					{ name: 'metadata', type: 'json' },
				],
				defaultWhere: () => ({ metadata: { scope: 'public', level: 1 } }),
			};

			resetMomentumAPI();
			const objConfig: MomentumConfig = {
				collections: [objectConstraintCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(objConfig);

			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Structured Item',
				metadata: { scope: 'public', level: 1 },
			});

			const result = await api.collection('structured-items').findById('1');

			// With strict ===, different object references fail the check
			// With deep equality, structurally identical objects should match
			expect(result).toBeDefined();
			expect(result?.title).toBe('Structured Item');
		});
	});

	describe('count() with where clause', () => {
		it('should pass where params to count()', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([{ id: '1' }]);

			await api.collection('posts').count({ title: { equals: 'Hello' } });

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ title: { $eq: 'Hello' } }),
			);
		});

		it('should enforce where-clause limits in count()', async () => {
			const api = initializeMomentumAPI(config).setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const bigWhere: Record<string, unknown> = {};
			for (let i = 0; i < 21; i++) bigWhere[`field${i}`] = 'val';

			await expect(api.collection('posts').count(bigWhere)).rejects.toThrow(
				/exceeds maximum of 20 conditions/,
			);
		});
	});

	describe('Issue #1: count() must inject defaultWhere and _status', () => {
		const scopedCollection: CollectionConfig = {
			slug: 'notes',
			labels: { singular: 'Note', plural: 'Notes' },
			fields: [
				{ name: 'body', type: 'text' },
				{ name: 'ownerId', type: 'text' },
			],
			defaultWhere: (req) => (req.user ? { ownerId: req.user.id } : undefined),
		};

		const versionedCollection: CollectionConfig = {
			slug: 'docs',
			labels: { singular: 'Doc', plural: 'Docs' },
			fields: [{ name: 'title', type: 'text', required: true }],
			versions: {
				drafts: true,
			},
			access: {
				readDrafts: ({ req }) => req.user?.role === 'admin',
			},
		};

		it('should inject defaultWhere constraints into count queries', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [scopedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			const authApi = api.setContext({ user: { id: 'user-42' }, overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([{ id: '1' }]);

			await authApi.collection('notes').count();

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'notes',
				expect.objectContaining({ ownerId: 'user-42' }),
			);
		});

		it('should inject _status=published in count for non-draft-readers', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [versionedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			const userApi = api.setContext({ user: { id: 'user-1', role: 'editor' } });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await userApi.collection('docs').count();

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'docs',
				expect.objectContaining({ _status: 'published' }),
			);
		});

		it('should NOT inject _status when user has readDrafts access', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [versionedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			const adminApi = api.setContext({ user: { id: 'admin-1', role: 'admin' } });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await adminApi.collection('docs').count();

			const callArgs = vi.mocked(mockAdapter.find).mock.calls[0][1];
			expect(callArgs).not.toHaveProperty('_status');
		});

		it('should NOT inject _status when overrideAccess is true', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [versionedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			const sysApi = api.setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await sysApi.collection('docs').count();

			const callArgs = vi.mocked(mockAdapter.find).mock.calls[0][1];
			expect(callArgs).not.toHaveProperty('_status');
		});
	});

	describe('Issue #2: count() should use adapter.count()', () => {
		it('should call adapter.count() when available', async () => {
			resetMomentumAPI();
			const adapterWithCount: DatabaseAdapter = {
				...mockAdapter,
				count: vi.fn().mockResolvedValue(42),
			};
			const cfg: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: adapterWithCount },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });

			const result = await api.collection('posts').count();

			expect(result).toBe(42);
			expect(adapterWithCount.count).toHaveBeenCalledWith('posts', expect.any(Object));
			expect(adapterWithCount.find).not.toHaveBeenCalled();
		});

		it('should fall back to adapter.find() when adapter.count() is not available', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			vi.mocked(mockAdapter.find).mockResolvedValue([{ id: '1' }, { id: '2' }]);
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });

			const result = await api.collection('posts').count();

			expect(result).toBe(2);
			expect(mockAdapter.find).toHaveBeenCalled();
		});

		it('should pass where params to adapter.count()', async () => {
			resetMomentumAPI();
			const adapterWithCount: DatabaseAdapter = {
				...mockAdapter,
				count: vi.fn().mockResolvedValue(5),
			};
			const cfg: MomentumConfig = {
				collections: [mockPostsCollection],
				db: { adapter: adapterWithCount },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg).setContext({ overrideAccess: true });

			await api.collection('posts').count({ status: { equals: 'published' } });

			expect(adapterWithCount.count).toHaveBeenCalledWith(
				'posts',
				expect.objectContaining({ status: { $eq: 'published' } }),
			);
		});
	});

	describe('search() must inject defaultWhere constraints', () => {
		const scopedCollection: CollectionConfig = {
			slug: 'notes',
			fields: [
				{ name: 'title', type: 'text', required: true },
				{ name: 'ownerId', type: 'text' },
			],
			defaultWhere: (req) => (req.user ? { ownerId: req.user.id } : undefined),
		};

		let scopedConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			scopedConfig = {
				collections: [scopedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should inject defaultWhere constraints into search adapter call', async () => {
			const api = initializeMomentumAPI(scopedConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await authApi.collection('notes').search('hello');

			// search falls back to adapter.find — should include defaultWhere constraint
			expect(mockAdapter.find).toHaveBeenCalledWith(
				'notes',
				expect.objectContaining({ ownerId: 'user-42' }),
			);
		});

		it('should inject defaultWhere when adapter has search method', async () => {
			const searchAdapter = {
				...mockAdapter,
				search: vi.fn().mockResolvedValue([
					{ id: '1', title: 'owned note', ownerId: 'user-42' },
					{ id: '2', title: 'other note', ownerId: 'user-99' },
				]),
			};
			const searchConfig: MomentumConfig = {
				collections: [scopedCollection],
				db: { adapter: searchAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(searchConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });

			const result = await authApi.collection('notes').search('hello');

			// Should filter out docs that don't match defaultWhere
			expect(result.docs).toHaveLength(1);
			expect(result.docs[0]).toHaveProperty('ownerId', 'user-42');
		});
	});
});
