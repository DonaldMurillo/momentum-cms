import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initializeMomentumAPI,
	resetMomentumAPI,
	AccessDeniedError,
	DraftNotVisibleError,
} from './momentum-api';
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

	describe('access control', () => {
		it('should allow read when access function returns true', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			// users collection allows read for everyone
			await expect(api.collection('users').find()).resolves.toBeDefined();
		});

		it('should deny create when user not authenticated', async () => {
			const api = initializeMomentumAPI(config);

			// users collection requires auth for create
			await expect(
				api.collection('users').create({ name: 'Test', email: 'test@example.com' }),
			).rejects.toThrow(AccessDeniedError);
		});

		it('should allow create when user is authenticated', async () => {
			const api = initializeMomentumAPI(config);
			const authApi = api.setContext({ user: { id: '1', email: 'user@example.com' } });
			vi.mocked(mockAdapter.create).mockResolvedValue({
				id: '1',
				name: 'Test',
				email: 'test@example.com',
			});

			await expect(
				authApi.collection('users').create({ name: 'Test', email: 'test@example.com' }),
			).resolves.toBeDefined();
		});

		it('should deny update when user is not admin', async () => {
			const api = initializeMomentumAPI(config);
			const userApi = api.setContext({ user: { id: '1', role: 'user' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', name: 'Existing' });

			await expect(userApi.collection('users').update('1', { name: 'Updated' })).rejects.toThrow(
				AccessDeniedError,
			);
		});

		it('should allow update when user is admin', async () => {
			const api = initializeMomentumAPI(config);
			const adminApi = api.setContext({ user: { id: '1', role: 'admin' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', name: 'Existing' });
			vi.mocked(mockAdapter.update).mockResolvedValue({ id: '1', name: 'Updated' });

			await expect(
				adminApi.collection('users').update('1', { name: 'Updated' }),
			).resolves.toBeDefined();
		});
	});

	describe('hooks', () => {
		it('should run beforeChange hooks on create', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.create).mockImplementation(async (_col, data) => ({
				id: '1',
				...data,
			}));

			await api.collection('articles').create({ title: 'My Article' });

			// beforeChange hook should add slug
			expect(mockAdapter.create).toHaveBeenCalledWith(
				'articles',
				expect.objectContaining({ slug: 'my-article' }),
			);
		});

		it('should run afterRead hooks on find', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([{ id: '1', title: 'Article' }]);

			const result = await api.collection('articles').find();

			// afterRead hook should add readAt
			expect(result.docs[0]).toHaveProperty('readAt');
		});

		it('should run afterRead hooks on findById', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'Article' });

			const result = await api.collection('articles').findById('1');

			// afterRead hook should add readAt
			expect(result).toHaveProperty('readAt');
		});
	});

	describe('draft visibility in findById', () => {
		const versionedCollection: CollectionConfig = {
			slug: 'articles',
			labels: { singular: 'Article', plural: 'Articles' },
			fields: [{ name: 'title', type: 'text', required: true }],
			versions: { drafts: true },
			access: {
				readDrafts: ({ req }) => req.user?.role === 'admin',
			},
		};

		let draftConfig: MomentumConfig;

		beforeEach(() => {
			resetMomentumAPI();
			draftConfig = {
				collections: [versionedCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should throw DraftNotVisibleError when user cannot read drafts and doc is draft', async () => {
			const api = initializeMomentumAPI(draftConfig);
			// Non-admin user → readDrafts returns false
			const userApi = api.setContext({ user: { id: 'user-1', role: 'editor' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Draft Article',
				_status: 'draft',
			});

			await expect(userApi.collection('articles').findById('1')).rejects.toThrow(
				DraftNotVisibleError,
			);
		});

		it('should return published doc even when user cannot read drafts', async () => {
			const api = initializeMomentumAPI(draftConfig);
			const userApi = api.setContext({ user: { id: 'user-1', role: 'editor' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '2',
				title: 'Published Article',
				_status: 'published',
			});

			const result = await userApi.collection('articles').findById('2');

			expect(result).toBeDefined();
			expect(result?.title).toBe('Published Article');
		});

		it('should return draft doc when user has readDrafts access', async () => {
			const api = initializeMomentumAPI(draftConfig);
			// Admin user → readDrafts returns true
			const adminApi = api.setContext({ user: { id: 'admin-1', role: 'admin' } });
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Draft Article',
				_status: 'draft',
			});

			const result = await adminApi.collection('articles').findById('1');

			expect(result).toBeDefined();
			expect(result?.title).toBe('Draft Article');
		});

		it('should return draft doc when overrideAccess is set', async () => {
			const api = initializeMomentumAPI(draftConfig);
			// Explicit overrideAccess bypasses draft checks
			const overrideApi = api.setContext({ overrideAccess: true });
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Draft Article',
				_status: 'draft',
			});

			const result = await overrideApi.collection('articles').findById('1');

			expect(result).toBeDefined();
			expect(result?.title).toBe('Draft Article');
		});
	});

	describe('Issue #2: collection-level read access must be checked on JOIN targets', () => {
		const secretCollection: CollectionConfig = {
			slug: 'secrets',
			labels: { singular: 'Secret', plural: 'Secrets' },
			fields: [{ name: 'value', type: 'text', required: true }],
			access: { read: () => false },
		};

		const itemsWithSecretCollection: CollectionConfig = {
			slug: 'items-secret',
			labels: { singular: 'Item', plural: 'Items' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{
					name: 'secret_ref',
					type: 'relationship',
					collection: () => secretCollection,
				} as CollectionConfig['fields'][number],
			],
		};

		it('should deny relationship join when user lacks read access on the target collection', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [secretCollection, itemsWithSecretCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			// No overrideAccess — normal user context
			const api = initializeMomentumAPI(cfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('items-secret').find({
					where: { secret_ref: { value: { equals: 'classified' } } },
				}),
			).rejects.toThrow(/access denied|cannot filter/i);
		});

		it('should allow relationship join when user has read access on the target collection', async () => {
			const openCollection: CollectionConfig = {
				slug: 'open-tags',
				labels: { singular: 'Tag', plural: 'Tags' },
				fields: [{ name: 'label', type: 'text', required: true }],
				// No access restriction
			};

			const itemsWithOpenCollection: CollectionConfig = {
				slug: 'items-open',
				labels: { singular: 'Item', plural: 'Items' },
				fields: [
					{ name: 'name', type: 'text', required: true },
					{
						name: 'tag_ref',
						type: 'relationship',
						collection: () => openCollection,
					} as CollectionConfig['fields'][number],
				],
			};

			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [openCollection, itemsWithOpenCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('items-open').find({
					where: { tag_ref: { label: { equals: 'safe' } } },
				}),
			).resolves.toBeDefined();
		});

		it('should deny relationship join in count() when user lacks read access on target', async () => {
			resetMomentumAPI();
			const cfg: MomentumConfig = {
				collections: [secretCollection, itemsWithSecretCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
			const api = initializeMomentumAPI(cfg);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await expect(
				api.collection('items-secret').count({
					secret_ref: { value: { equals: 'classified' } },
				}),
			).rejects.toThrow(/access denied|cannot filter/i);
		});
	});
});
