import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initializeMomentumAPI,
	getMomentumAPI,
	isMomentumAPIInitialized,
	resetMomentumAPI,
	CollectionNotFoundError,
	DocumentNotFoundError,
	DraftNotVisibleError,
	AccessDeniedError,
	ValidationError,
} from './momentum-api';
import type { CollectionConfig, MomentumConfig, DatabaseAdapter } from '@momentumcms/core';

// Mock collection for testing
const mockPostsCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'content', type: 'textarea', label: 'Content' },
		{ name: 'status', type: 'select', options: [{ value: 'draft' }, { value: 'published' }] },
	],
};

const mockUsersCollection: CollectionConfig = {
	slug: 'users',
	labels: { singular: 'User', plural: 'Users' },
	fields: [
		{ name: 'name', type: 'text', required: true, label: 'Name' },
		{ name: 'email', type: 'email', required: true, label: 'Email' },
	],
	access: {
		read: () => true,
		create: ({ req }) => !!req.user,
		update: ({ req }) => req.user?.role === 'admin',
		delete: ({ req }) => req.user?.role === 'admin',
	},
};

const mockCollectionWithHooks: CollectionConfig = {
	slug: 'articles',
	fields: [{ name: 'title', type: 'text', required: true }],
	hooks: {
		beforeChange: [
			({ data }) => ({
				...data,
				slug: (data?.title as string)?.toLowerCase().replace(/\s+/g, '-'),
			}),
		],
		afterRead: [({ doc }) => ({ ...doc, readAt: new Date().toISOString() })],
	},
};

describe('MomentumAPI', () => {
	let mockAdapter: DatabaseAdapter;
	let config: MomentumConfig;

	beforeEach(() => {
		// Reset singleton before each test
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

	describe('initialization', () => {
		it('should initialize the API singleton', () => {
			expect(isMomentumAPIInitialized()).toBe(false);
			initializeMomentumAPI(config);
			expect(isMomentumAPIInitialized()).toBe(true);
		});

		it('should return existing instance on double initialization', () => {
			const api1 = initializeMomentumAPI(config);
			const api2 = initializeMomentumAPI(config);
			expect(api1).toBe(api2);
		});

		it('should throw when getting uninitialized API', () => {
			expect(() => getMomentumAPI()).toThrow('MomentumAPI not initialized');
		});

		it('should return the initialized API', () => {
			initializeMomentumAPI(config);
			const api = getMomentumAPI();
			expect(api).toBeDefined();
			expect(api.getConfig()).toBe(config);
		});
	});

	describe('collection()', () => {
		it('should return collection operations for valid slug', () => {
			const api = initializeMomentumAPI(config);
			const collection = api.collection('posts');
			expect(collection).toBeDefined();
			expect(typeof collection.find).toBe('function');
			expect(typeof collection.findById).toBe('function');
			expect(typeof collection.create).toBe('function');
			expect(typeof collection.update).toBe('function');
			expect(typeof collection.delete).toBe('function');
		});

		it('should throw CollectionNotFoundError for invalid slug', () => {
			const api = initializeMomentumAPI(config);
			expect(() => api.collection('nonexistent')).toThrow(CollectionNotFoundError);
		});
	});

	describe('setContext()', () => {
		it('should return new instance with merged context', () => {
			const api = initializeMomentumAPI(config);
			const user = { id: '1', email: 'test@example.com' };
			const contextualApi = api.setContext({ user });

			expect(contextualApi).not.toBe(api);
			expect(contextualApi.getContext().user).toEqual(user);
			expect(api.getContext().user).toBeUndefined();
		});

		it('should merge context on multiple setContext calls', () => {
			const api = initializeMomentumAPI(config);
			const api2 = api.setContext({ user: { id: '1' } });
			const api3 = api2.setContext({ locale: 'en' });

			expect(api3.getContext().user).toEqual({ id: '1' });
			expect(api3.getContext().locale).toBe('en');
		});
	});

	describe('find()', () => {
		it('should return paginated results', async () => {
			const api = initializeMomentumAPI(config);
			const mockDocs = [
				{ id: '1', title: 'Post 1' },
				{ id: '2', title: 'Post 2' },
			];
			vi.mocked(mockAdapter.find).mockResolvedValue(mockDocs);

			const result = await api.collection('posts').find({ limit: 10 });

			expect(result.docs).toEqual(mockDocs);
			expect(result.page).toBe(1);
			expect(result.limit).toBe(10);
			expect(mockAdapter.find).toHaveBeenCalledWith('posts', expect.any(Object));
		});

		it('should use default pagination', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			const result = await api.collection('posts').find();

			expect(result.page).toBe(1);
			expect(result.limit).toBe(10);
		});

		it('should calculate pagination metadata', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([{ id: '1' }]);

			const result = await api.collection('posts').find({ limit: 10, page: 1 });

			expect(result.totalDocs).toBe(1);
			expect(result.hasNextPage).toBe(false);
			expect(result.hasPrevPage).toBe(false);
		});
	});

	describe('findById()', () => {
		it('should return document by ID', async () => {
			const api = initializeMomentumAPI(config);
			const mockDoc = { id: '1', title: 'Test Post' };
			vi.mocked(mockAdapter.findById).mockResolvedValue(mockDoc);

			const result = await api.collection('posts').findById('1');

			expect(result).toEqual(mockDoc);
			expect(mockAdapter.findById).toHaveBeenCalledWith('posts', '1');
		});

		it('should throw DocumentNotFoundError when document does not exist', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			await expect(api.collection('posts').findById('nonexistent')).rejects.toThrow(
				DocumentNotFoundError,
			);
		});
	});

	describe('create()', () => {
		it('should create and return new document', async () => {
			const api = initializeMomentumAPI(config);
			const newDoc = { id: '1', title: 'New Post', content: 'Hello' };
			vi.mocked(mockAdapter.create).mockResolvedValue(newDoc);

			const result = await api.collection('posts').create({ title: 'New Post', content: 'Hello' });

			expect(result).toEqual(newDoc);
			expect(mockAdapter.create).toHaveBeenCalledWith('posts', {
				title: 'New Post',
				content: 'Hello',
			});
		});

		it('should throw ValidationError for missing required fields', async () => {
			const api = initializeMomentumAPI(config);

			await expect(api.collection('posts').create({ content: 'Missing title' })).rejects.toThrow(
				ValidationError,
			);
		});

		it('should include field name in validation error', async () => {
			const api = initializeMomentumAPI(config);

			try {
				await api.collection('posts').create({ content: 'Missing title' });
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(ValidationError);
				const validationError = error as ValidationError;
				expect(validationError.errors).toContainEqual({
					field: 'title',
					message: 'Title is required',
				});
			}
		});
	});

	describe('update()', () => {
		it('should update and return document', async () => {
			const api = initializeMomentumAPI(config);
			const existingDoc = { id: '1', title: 'Old Title' };
			const updatedDoc = { id: '1', title: 'New Title' };
			vi.mocked(mockAdapter.findById).mockResolvedValue(existingDoc);
			vi.mocked(mockAdapter.update).mockResolvedValue(updatedDoc);

			const result = await api.collection('posts').update('1', { title: 'New Title' });

			expect(result).toEqual(updatedDoc);
			expect(mockAdapter.update).toHaveBeenCalledWith('posts', '1', { title: 'New Title' });
		});

		it('should throw DocumentNotFoundError when document does not exist', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			await expect(
				api.collection('posts').update('nonexistent', { title: 'Update' }),
			).rejects.toThrow(DocumentNotFoundError);
		});
	});

	describe('delete()', () => {
		it('should delete document and return result', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'To Delete' });
			vi.mocked(mockAdapter.delete).mockResolvedValue(true);

			const result = await api.collection('posts').delete('1');

			expect(result.id).toBe('1');
			expect(result.deleted).toBe(true);
			expect(mockAdapter.delete).toHaveBeenCalledWith('posts', '1');
		});

		it('should throw DocumentNotFoundError when document does not exist', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			await expect(api.collection('posts').delete('nonexistent')).rejects.toThrow(
				DocumentNotFoundError,
			);
		});
	});

	describe('count()', () => {
		it('should return count of documents', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

			const count = await api.collection('posts').count();

			expect(count).toBe(3);
		});

		it('should pass where clause to adapter', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('posts').count({ status: 'published' });

			expect(mockAdapter.find).toHaveBeenCalledWith('posts', { status: 'published', limit: 0 });
		});
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

	describe('Soft Delete', () => {
		const softDeleteCollection: CollectionConfig = {
			slug: 'pages',
			fields: [{ name: 'title', type: 'text', required: true }],
			softDelete: true,
		};

		let softDeleteConfig: MomentumConfig;

		beforeEach(() => {
			softDeleteConfig = {
				collections: [softDeleteCollection],
				db: { adapter: mockAdapter },
				server: { port: 4000 },
			};
		});

		it('should inject deletedAt: null into find query for soft-delete collections', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('pages').find();

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'pages',
				expect.objectContaining({ deletedAt: null }),
			);
		});

		it('should not inject deletedAt filter when withDeleted is true', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('pages').find({ withDeleted: true });

			const callArgs = vi.mocked(mockAdapter.find).mock.calls[0]?.[1];
			expect(callArgs).not.toHaveProperty('deletedAt');
		});

		it('should inject $ne null filter when onlyDeleted is true', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.find).mockResolvedValue([]);

			await api.collection('pages').find({ onlyDeleted: true });

			expect(mockAdapter.find).toHaveBeenCalledWith(
				'pages',
				expect.objectContaining({ deletedAt: { $ne: null } }),
			);
		});

		it('should throw DocumentNotFoundError for soft-deleted docs from findById by default', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Page',
				deletedAt: '2024-06-01T00:00:00Z',
			});

			await expect(api.collection('pages').findById('1')).rejects.toThrow(DocumentNotFoundError);
		});

		it('should return soft-deleted docs from findById when withDeleted is true', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			const deletedDoc = { id: '1', title: 'Page', deletedAt: '2024-06-01T00:00:00Z' };
			vi.mocked(mockAdapter.findById).mockResolvedValue(deletedDoc);

			const result = await api.collection('pages').findById('1', { withDeleted: true });

			expect(result).toEqual(deletedDoc);
		});

		it('should call adapter.softDelete when deleting from soft-delete collection', async () => {
			resetMomentumAPI();
			mockAdapter.softDelete = vi.fn().mockResolvedValue(true);
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'Page' });

			await api.collection('pages').delete('1');

			expect(mockAdapter.softDelete).toHaveBeenCalledWith('pages', '1', 'deletedAt');
			expect(mockAdapter.delete).not.toHaveBeenCalled();
		});

		it('should call adapter.delete for forceDelete', async () => {
			resetMomentumAPI();
			mockAdapter.softDelete = vi.fn();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: '1', title: 'Page' });
			vi.mocked(mockAdapter.delete).mockResolvedValue(true);

			await api.collection('pages').forceDelete('1');

			expect(mockAdapter.delete).toHaveBeenCalledWith('pages', '1');
			expect(mockAdapter.softDelete).not.toHaveBeenCalled();
		});

		it('should restore a soft-deleted document', async () => {
			resetMomentumAPI();
			const restoredDoc = { id: '1', title: 'Page', deletedAt: null };
			mockAdapter.restore = vi.fn().mockResolvedValue(restoredDoc);
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Page',
				deletedAt: '2024-06-01T00:00:00Z',
			});
			const api = initializeMomentumAPI(softDeleteConfig);

			const result = await api.collection('pages').restore('1');

			expect(mockAdapter.restore).toHaveBeenCalledWith('pages', '1', 'deletedAt');
			expect(result).toEqual(restoredDoc);
		});

		it('should throw when restoring from non-soft-delete collection', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(config);

			await expect(api.collection('posts').restore('1')).rejects.toThrow();
		});
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

	// ============================================
	// Issue #4: dot-notation where clauses on JSON/group fields
	// ============================================

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

	// ============================================
	// Issue #1: count() must inject defaultWhere + _status
	// ============================================

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

	// ============================================
	// Issue #2: count() should use adapter.count() instead of loading all rows
	// ============================================

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

	// ============================================
	// TDD: Bug fixes for review issues #1, #2, #3
	// ============================================

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

	// ============================================
	// Pagination input sanitization
	// ============================================

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

	// ============================================
	// $exists operator string coercion
	// ============================================

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

	// ============================================
	// count() with where clause
	// ============================================

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

	// ============================================
	// __proto__ in where clause
	// ============================================

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
			if (titleClause && typeof titleClause === 'object') {
				const eqVal = (titleClause as Record<string, unknown>)['$eq'];
				expect(eqVal).not.toContain('\x00');
			}
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
			if (titleClause && typeof titleClause === 'object') {
				const containsVal = (titleClause as Record<string, unknown>)['$contains'];
				expect(containsVal).not.toContain('\x00');
			}
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

	describe('restore on non-soft-delete collection', () => {
		it('should throw ValidationError for collections without soft delete', async () => {
			const api = initializeMomentumAPI(config);

			await expect(api.collection('posts').restore('some-id')).rejects.toThrow(ValidationError);
		});
	});
});
