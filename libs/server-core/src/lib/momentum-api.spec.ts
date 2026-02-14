import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	initializeMomentumAPI,
	getMomentumAPI,
	isMomentumAPIInitialized,
	resetMomentumAPI,
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	ValidationError,
} from './momentum-api';
import type { CollectionConfig, MomentumConfig, DatabaseAdapter } from '@momentum-cms/core';

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

		it('should return null when document not found', async () => {
			const api = initializeMomentumAPI(config);
			vi.mocked(mockAdapter.findById).mockResolvedValue(null);

			const result = await api.collection('posts').findById('nonexistent');

			expect(result).toBeNull();
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

		it('should filter soft-deleted docs from findById by default', async () => {
			resetMomentumAPI();
			const api = initializeMomentumAPI(softDeleteConfig);
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Page',
				deletedAt: '2024-06-01T00:00:00Z',
			});

			const result = await api.collection('pages').findById('1');

			expect(result).toBeNull();
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

		it('should reject findById when doc does not match defaultWhere (string constraint)', async () => {
			const api = initializeMomentumAPI(scopedConfig);
			const authApi = api.setContext({ user: { id: 'user-42' } });
			// Doc belongs to a different user
			vi.mocked(mockAdapter.findById).mockResolvedValue({
				id: '1',
				title: 'Secret',
				ownerId: 'user-99',
			});

			const result = await authApi.collection('notes').findById('1');

			expect(result).toBeNull();
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
});
