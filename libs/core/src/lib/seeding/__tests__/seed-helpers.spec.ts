import { describe, it, expect } from 'vitest';
import { createSeedHelpers } from '../seed-helpers';

describe('createSeedHelpers', () => {
	describe('admin helper', () => {
		it('should create admin seed entity with correct structure', () => {
			const helpers = createSeedHelpers();
			const admin = helpers.admin('first-admin', {
				name: 'Admin User',
				email: 'admin@example.com',
			});

			expect(admin.seedId).toBe('first-admin');
			expect(admin.collection).toBe('user');
			expect(admin.data.name).toBe('Admin User');
			expect(admin.data.email).toBe('admin@example.com');
		});

		it('should set admin role by default', () => {
			const helpers = createSeedHelpers();
			const admin = helpers.admin('admin', {
				name: 'Admin',
				email: 'admin@example.com',
			});

			expect(admin.data.role).toBe('admin');
		});

		it('should set emailVerified to true by default for admins', () => {
			const helpers = createSeedHelpers();
			const admin = helpers.admin('admin', {
				name: 'Admin',
				email: 'admin@example.com',
			});

			expect(admin.data.emailVerified).toBe(true);
		});

		it('should allow overriding default values', () => {
			const helpers = createSeedHelpers();
			const admin = helpers.admin('admin', {
				name: 'Admin',
				email: 'admin@example.com',
				role: 'superadmin',
				emailVerified: false,
			});

			expect(admin.data.role).toBe('superadmin');
			expect(admin.data.emailVerified).toBe(false);
		});

		it('should accept optional seed options', () => {
			const helpers = createSeedHelpers();
			const admin = helpers.admin(
				'admin',
				{ name: 'Admin', email: 'admin@example.com' },
				{ onConflict: 'skip' },
			);

			expect(admin.options).toEqual({ onConflict: 'skip' });
		});
	});

	describe('user helper', () => {
		it('should create user seed entity with correct structure', () => {
			const helpers = createSeedHelpers();
			const user = helpers.user('regular-user', {
				name: 'John Doe',
				email: 'john@example.com',
			});

			expect(user.seedId).toBe('regular-user');
			expect(user.collection).toBe('user');
			expect(user.data.name).toBe('John Doe');
			expect(user.data.email).toBe('john@example.com');
		});

		it('should set user role by default', () => {
			const helpers = createSeedHelpers();
			const user = helpers.user('user', {
				name: 'User',
				email: 'user@example.com',
			});

			expect(user.data.role).toBe('user');
		});

		it('should set emailVerified to false by default for users', () => {
			const helpers = createSeedHelpers();
			const user = helpers.user('user', {
				name: 'User',
				email: 'user@example.com',
			});

			expect(user.data.emailVerified).toBe(false);
		});

		it('should allow overriding default values', () => {
			const helpers = createSeedHelpers();
			const user = helpers.user('user', {
				name: 'User',
				email: 'user@example.com',
				role: 'editor',
				emailVerified: true,
			});

			expect(user.data.role).toBe('editor');
			expect(user.data.emailVerified).toBe(true);
		});

		it('should accept optional seed options', () => {
			const helpers = createSeedHelpers();
			const user = helpers.user(
				'user',
				{ name: 'User', email: 'user@example.com' },
				{ onConflict: 'update' },
			);

			expect(user.options).toEqual({ onConflict: 'update' });
		});
	});

	describe('collection helper', () => {
		it('should create collection seed builder', () => {
			const helpers = createSeedHelpers();
			const builder = helpers.collection('posts');

			expect(builder).toBeDefined();
			expect(typeof builder.create).toBe('function');
		});

		it('should create seed entity with correct collection', () => {
			const helpers = createSeedHelpers();
			const post = helpers.collection<{ title: string }>('posts').create('first-post', {
				title: 'Hello World',
			});

			expect(post.seedId).toBe('first-post');
			expect(post.collection).toBe('posts');
			expect(post.data.title).toBe('Hello World');
		});

		it('should work with different collection slugs', () => {
			const helpers = createSeedHelpers();

			const category = helpers.collection('categories').create('tech', { name: 'Technology' });
			const article = helpers.collection('articles').create('first', { title: 'Article' });

			expect(category.collection).toBe('categories');
			expect(article.collection).toBe('articles');
		});

		it('should accept partial data', () => {
			interface PostDoc {
				title: string;
				content?: string;
				published?: boolean;
			}

			const helpers = createSeedHelpers();
			const post = helpers.collection<PostDoc>('posts').create('draft', {
				title: 'Draft Post',
				// content and published not provided
			});

			expect(post.data.title).toBe('Draft Post');
			expect(post.data.content).toBeUndefined();
			expect(post.data.published).toBeUndefined();
		});

		it('should accept optional seed options', () => {
			const helpers = createSeedHelpers();
			const post = helpers
				.collection<{ title: string }>('posts')
				.create('post', { title: 'Test' }, { onConflict: 'error' });

			expect(post.options).toEqual({ onConflict: 'error' });
		});

		it('should preserve type information for data', () => {
			interface CustomDoc {
				name: string;
				count: number;
				tags: string[];
			}

			const helpers = createSeedHelpers();
			const item = helpers.collection<CustomDoc>('items').create('item-1', {
				name: 'Test Item',
				count: 42,
				tags: ['tag1', 'tag2'],
			});

			// Type checking - this should compile without errors
			expect(item.data.name).toBe('Test Item');
			expect(item.data.count).toBe(42);
			expect(item.data.tags).toEqual(['tag1', 'tag2']);
		});
	});

	describe('helper combination', () => {
		it('should work in typical seeding config pattern', () => {
			const helpers = createSeedHelpers();

			// Simulate typical usage in seeding config
			const seeds = [
				helpers.admin('admin-1', { name: 'Admin', email: 'admin@example.com' }),
				helpers.user('user-1', { name: 'User', email: 'user@example.com' }),
				helpers.collection<{ title: string }>('posts').create('post-1', { title: 'First' }),
				helpers.collection<{ name: string }>('categories').create('cat-1', { name: 'Tech' }),
			];

			expect(seeds).toHaveLength(4);
			expect(seeds[0].collection).toBe('user');
			expect(seeds[1].collection).toBe('user');
			expect(seeds[2].collection).toBe('posts');
			expect(seeds[3].collection).toBe('categories');
		});

		it('should return independent seed entities', () => {
			const helpers = createSeedHelpers();

			const post1 = helpers.collection<{ title: string }>('posts').create('post-1', { title: 'A' });
			const post2 = helpers.collection<{ title: string }>('posts').create('post-2', { title: 'B' });

			// Modifying one should not affect the other
			expect(post1.seedId).not.toBe(post2.seedId);
			expect(post1.data.title).not.toBe(post2.data.title);
		});
	});
});
