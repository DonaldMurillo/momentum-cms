import { describe, it, expect } from 'vitest';
import { createSeedHelpers } from '../../lib/seeding/seed-helpers';
import type { SeedEntity } from '../../lib/seeding/seeding.types';

describe('createSeedHelpers', () => {
	describe('admin()', () => {
		it('should create admin seed entity with admin defaults', () => {
			const helpers = createSeedHelpers();
			const result = helpers.admin('first-admin', {
				name: 'System Admin',
				email: 'admin@example.com',
			});

			expect(result).toEqual({
				seedId: 'first-admin',
				collection: 'user',
				data: {
					name: 'System Admin',
					email: 'admin@example.com',
					role: 'admin', // Admin by default
					emailVerified: true, // Pre-verified by default
				},
				options: undefined,
			});
		});

		it('should allow custom role override', () => {
			const helpers = createSeedHelpers();
			const result = helpers.admin('super-admin', {
				name: 'Super Admin',
				email: 'super@example.com',
				role: 'superadmin',
			});

			expect(result.data.role).toBe('superadmin');
		});

		it('should allow disabling email verification', () => {
			const helpers = createSeedHelpers();
			const result = helpers.admin('unverified-admin', {
				name: 'Admin',
				email: 'admin@example.com',
				emailVerified: false,
			});

			expect(result.data.emailVerified).toBe(false);
		});

		it('should include image when provided', () => {
			const helpers = createSeedHelpers();
			const result = helpers.admin('admin-with-avatar', {
				name: 'Admin',
				email: 'admin@example.com',
				image: 'https://example.com/admin-avatar.png',
			});

			expect(result.data.image).toBe('https://example.com/admin-avatar.png');
		});

		it('should include options when provided', () => {
			const helpers = createSeedHelpers();
			const result = helpers.admin(
				'first-admin',
				{ name: 'Admin', email: 'admin@example.com' },
				{ onConflict: 'skip' },
			);

			expect(result.options).toEqual({ onConflict: 'skip' });
		});
	});

	describe('user()', () => {
		it('should create user seed entity with required fields', () => {
			const helpers = createSeedHelpers();
			const result = helpers.user('admin-user', {
				name: 'Admin',
				email: 'admin@example.com',
			});

			expect(result).toEqual({
				seedId: 'admin-user',
				collection: 'user',
				data: {
					name: 'Admin',
					email: 'admin@example.com',
					role: 'user', // Default
					emailVerified: false, // Default
				},
				options: undefined,
			});
		});

		it('should allow custom role override', () => {
			const helpers = createSeedHelpers();
			const result = helpers.user('admin-user', {
				name: 'Admin',
				email: 'admin@example.com',
				role: 'admin',
			});

			expect(result.data.role).toBe('admin');
		});

		it('should allow custom emailVerified', () => {
			const helpers = createSeedHelpers();
			const result = helpers.user('verified-user', {
				name: 'Verified',
				email: 'verified@example.com',
				emailVerified: true,
			});

			expect(result.data.emailVerified).toBe(true);
		});

		it('should include image when provided', () => {
			const helpers = createSeedHelpers();
			const result = helpers.user('user-with-image', {
				name: 'User',
				email: 'user@example.com',
				image: 'https://example.com/avatar.png',
			});

			expect(result.data.image).toBe('https://example.com/avatar.png');
		});

		it('should include options when provided', () => {
			const helpers = createSeedHelpers();
			const result = helpers.user(
				'admin-user',
				{ name: 'Admin', email: 'admin@example.com' },
				{ onConflict: 'update', skipHooks: true },
			);

			expect(result.options).toEqual({
				onConflict: 'update',
				skipHooks: true,
			});
		});
	});

	describe('collection()', () => {
		interface PostDoc {
			title: string;
			content: string;
			status: 'draft' | 'published';
		}

		it('should create typed collection builder', () => {
			const helpers = createSeedHelpers();
			const builder = helpers.collection<PostDoc>('posts');

			expect(builder).toHaveProperty('create');
			expect(typeof builder.create).toBe('function');
		});

		it('should create seed entity with correct structure', () => {
			const helpers = createSeedHelpers();
			const result = helpers.collection<PostDoc>('posts').create('welcome-post', {
				title: 'Welcome',
				content: 'Hello world',
				status: 'published',
			});

			expect(result).toEqual({
				seedId: 'welcome-post',
				collection: 'posts',
				data: {
					title: 'Welcome',
					content: 'Hello world',
					status: 'published',
				},
				options: undefined,
			});
		});

		it('should accept partial data', () => {
			const helpers = createSeedHelpers();
			const result = helpers.collection<PostDoc>('posts').create('draft-post', {
				title: 'Draft',
			});

			expect(result.data).toEqual({ title: 'Draft' });
		});

		it('should include options when provided', () => {
			const helpers = createSeedHelpers();
			const result = helpers
				.collection<PostDoc>('posts')
				.create('protected-post', { title: 'Protected' }, { onConflict: 'error' });

			expect(result.options).toEqual({ onConflict: 'error' });
		});
	});

	describe('defaults function integration', () => {
		it('should work as expected in defaults callback', () => {
			const helpers = createSeedHelpers();

			// Simulate how it would be used in config
			const defaults = (h: typeof helpers): SeedEntity[] => [
				h.admin('first-admin', { name: 'Admin', email: 'admin@example.com' }),
				h.user('regular-user', { name: 'John', email: 'john@example.com' }),
				h.collection<{ title: string }>('posts').create('first-post', { title: 'First Post' }),
			];

			const entities = defaults(helpers);

			expect(entities).toHaveLength(3);
			expect(entities[0].seedId).toBe('first-admin');
			expect(entities[0].collection).toBe('user');
			expect(entities[0].data.role).toBe('admin');
			expect(entities[1].seedId).toBe('regular-user');
			expect(entities[1].data.role).toBe('user');
			expect(entities[2].seedId).toBe('first-post');
			expect(entities[2].collection).toBe('posts');
		});
	});
});
