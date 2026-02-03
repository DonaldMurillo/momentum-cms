import { describe, it, expect } from 'vitest';
import {
	checkCollectionAdminAccess,
	checkSingleCollectionAdminAccess,
	getCollectionPermissions,
} from './collection-access';
import type { CollectionConfig, MomentumConfig, UserContext } from '@momentum-cms/core';

// Mock collections for testing
const publicCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
	// No access config = authenticated users get admin access
};

const adminOnlyCollection: CollectionConfig = {
	slug: 'users',
	fields: [{ name: 'name', type: 'text' }],
	access: {
		admin: ({ req }) => req.user?.role === 'admin',
		read: ({ req }) => req.user?.role === 'admin',
		create: ({ req }) => req.user?.role === 'admin',
		update: ({ req }) => req.user?.role === 'admin',
		delete: ({ req }) => req.user?.role === 'admin',
	},
};

const publicReadCollection: CollectionConfig = {
	slug: 'articles',
	fields: [{ name: 'content', type: 'textarea' }],
	access: {
		admin: ({ req }) => !!req.user,
		read: () => true, // Public read
		create: ({ req }) => !!req.user,
		update: ({ req }) => !!req.user,
		delete: ({ req }) => req.user?.role === 'admin',
	},
};

const asyncAccessCollection: CollectionConfig = {
	slug: 'async-test',
	fields: [{ name: 'data', type: 'text' }],
	access: {
		admin: async ({ req }) => {
			// Simulate async check
			await Promise.resolve();
			return !!req.user;
		},
	},
};

const denyAllCollection: CollectionConfig = {
	slug: 'denied',
	fields: [{ name: 'secret', type: 'text' }],
	access: {
		admin: () => false,
		read: () => false,
		create: () => false,
		update: () => false,
		delete: () => false,
	},
};

const mockConfig: MomentumConfig = {
	collections: [
		publicCollection,
		adminOnlyCollection,
		publicReadCollection,
		asyncAccessCollection,
		denyAllCollection,
	],
	db: {
		adapter: {
			find: async () => [],
			findById: async () => null,
			create: async () => ({}),
			update: async () => ({}),
			delete: async () => false,
		},
	},
};

const adminUser: UserContext = { id: '1', email: 'admin@example.com', role: 'admin' };
const regularUser: UserContext = { id: '2', email: 'user@example.com', role: 'user' };

describe('collection-access', () => {
	describe('checkSingleCollectionAdminAccess', () => {
		it('should allow authenticated users when no admin access function defined', async () => {
			const result = await checkSingleCollectionAdminAccess(publicCollection, regularUser);
			expect(result).toBe(true);
		});

		it('should deny unauthenticated users when no admin access function defined', async () => {
			const result = await checkSingleCollectionAdminAccess(publicCollection, undefined);
			expect(result).toBe(false);
		});

		it('should allow admin users for admin-only collection', async () => {
			const result = await checkSingleCollectionAdminAccess(adminOnlyCollection, adminUser);
			expect(result).toBe(true);
		});

		it('should deny regular users for admin-only collection', async () => {
			const result = await checkSingleCollectionAdminAccess(adminOnlyCollection, regularUser);
			expect(result).toBe(false);
		});

		it('should allow any authenticated user for public-admin collection', async () => {
			const result = await checkSingleCollectionAdminAccess(publicReadCollection, regularUser);
			expect(result).toBe(true);
		});

		it('should handle async access functions', async () => {
			const result = await checkSingleCollectionAdminAccess(asyncAccessCollection, regularUser);
			expect(result).toBe(true);
		});

		it('should deny all users when admin access returns false', async () => {
			const adminResult = await checkSingleCollectionAdminAccess(denyAllCollection, adminUser);
			const userResult = await checkSingleCollectionAdminAccess(denyAllCollection, regularUser);
			expect(adminResult).toBe(false);
			expect(userResult).toBe(false);
		});
	});

	describe('checkCollectionAdminAccess', () => {
		it('should return access status for all collections', async () => {
			const results = await checkCollectionAdminAccess(mockConfig, adminUser);

			expect(results).toHaveLength(5);
			expect(results.map((r) => r.slug)).toEqual([
				'posts',
				'users',
				'articles',
				'async-test',
				'denied',
			]);
		});

		it('should correctly identify accessible collections for admin', async () => {
			const results = await checkCollectionAdminAccess(mockConfig, adminUser);

			expect(results.find((r) => r.slug === 'posts')?.canAccess).toBe(true);
			expect(results.find((r) => r.slug === 'users')?.canAccess).toBe(true);
			expect(results.find((r) => r.slug === 'articles')?.canAccess).toBe(true);
			expect(results.find((r) => r.slug === 'denied')?.canAccess).toBe(false);
		});

		it('should correctly identify accessible collections for regular user', async () => {
			const results = await checkCollectionAdminAccess(mockConfig, regularUser);

			expect(results.find((r) => r.slug === 'posts')?.canAccess).toBe(true);
			expect(results.find((r) => r.slug === 'users')?.canAccess).toBe(false);
			expect(results.find((r) => r.slug === 'articles')?.canAccess).toBe(true);
			expect(results.find((r) => r.slug === 'denied')?.canAccess).toBe(false);
		});

		it('should deny all for unauthenticated users except explicit allows', async () => {
			const results = await checkCollectionAdminAccess(mockConfig, undefined);

			// No admin access defined = requires auth = denied for undefined user
			expect(results.find((r) => r.slug === 'posts')?.canAccess).toBe(false);
			expect(results.find((r) => r.slug === 'users')?.canAccess).toBe(false);
			expect(results.find((r) => r.slug === 'articles')?.canAccess).toBe(false);
			expect(results.find((r) => r.slug === 'denied')?.canAccess).toBe(false);
		});
	});

	describe('getCollectionPermissions', () => {
		it('should return full permissions for all collections', async () => {
			const results = await getCollectionPermissions(mockConfig, adminUser);

			expect(results).toHaveLength(5);
			results.forEach((r) => {
				expect(r).toHaveProperty('slug');
				expect(r).toHaveProperty('canAccess');
				expect(r).toHaveProperty('canCreate');
				expect(r).toHaveProperty('canRead');
				expect(r).toHaveProperty('canUpdate');
				expect(r).toHaveProperty('canDelete');
			});
		});

		it('should return correct permissions for admin user', async () => {
			const results = await getCollectionPermissions(mockConfig, adminUser);

			const posts = results.find((r) => r.slug === 'posts');
			expect(posts?.canAccess).toBe(true);
			expect(posts?.canCreate).toBe(true); // default: authenticated
			expect(posts?.canRead).toBe(true); // default: everyone
			expect(posts?.canUpdate).toBe(true); // default: authenticated
			expect(posts?.canDelete).toBe(true); // default: authenticated

			const users = results.find((r) => r.slug === 'users');
			expect(users?.canAccess).toBe(true);
			expect(users?.canCreate).toBe(true);
			expect(users?.canRead).toBe(true);
			expect(users?.canUpdate).toBe(true);
			expect(users?.canDelete).toBe(true);
		});

		it('should return correct permissions for regular user', async () => {
			const results = await getCollectionPermissions(mockConfig, regularUser);

			const posts = results.find((r) => r.slug === 'posts');
			expect(posts?.canAccess).toBe(true);
			expect(posts?.canCreate).toBe(true);
			expect(posts?.canRead).toBe(true);
			expect(posts?.canUpdate).toBe(true);
			expect(posts?.canDelete).toBe(true);

			const users = results.find((r) => r.slug === 'users');
			expect(users?.canAccess).toBe(false);
			expect(users?.canCreate).toBe(false);
			expect(users?.canRead).toBe(false);
			expect(users?.canUpdate).toBe(false);
			expect(users?.canDelete).toBe(false);

			const articles = results.find((r) => r.slug === 'articles');
			expect(articles?.canAccess).toBe(true);
			expect(articles?.canCreate).toBe(true);
			expect(articles?.canRead).toBe(true);
			expect(articles?.canUpdate).toBe(true);
			expect(articles?.canDelete).toBe(false); // Only admin can delete
		});

		it('should handle unauthenticated user', async () => {
			const results = await getCollectionPermissions(mockConfig, undefined);

			const articles = results.find((r) => r.slug === 'articles');
			expect(articles?.canAccess).toBe(false); // Requires auth
			expect(articles?.canCreate).toBe(false); // Requires auth
			expect(articles?.canRead).toBe(true); // Public read
			expect(articles?.canUpdate).toBe(false); // Requires auth
			expect(articles?.canDelete).toBe(false); // Requires admin
		});
	});
});
