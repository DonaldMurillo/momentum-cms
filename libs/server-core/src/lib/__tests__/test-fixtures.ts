import { vi } from 'vitest';
import type { CollectionConfig, MomentumConfig, DatabaseAdapter } from '@momentumcms/core';
import { initializeMomentumAPI, resetMomentumAPI } from '../momentum-api';

// Mock collection for testing
export const mockPostsCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'content', type: 'textarea', label: 'Content' },
		{
			name: 'status',
			type: 'select',
			options: [
				{ value: 'draft', label: 'Draft' },
				{ value: 'published', label: 'Published' },
			],
		},
	],
};

export const mockUsersCollection: CollectionConfig = {
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

export const mockCollectionWithHooks: CollectionConfig = {
	slug: 'articles',
	fields: [{ name: 'title', type: 'text', required: true }],
	hooks: {
		beforeChange: [
			({ data }) => ({
				...data,
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture
				slug: (data?.title as string)?.toLowerCase().replace(/\s+/g, '-'),
			}),
		],
		afterRead: [({ doc }) => ({ ...doc, readAt: new Date().toISOString() })],
	},
};

export function createMockAdapter(): DatabaseAdapter {
	return {
		find: vi.fn(),
		findById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};
}

export function createTestConfig(
	collections?: CollectionConfig[],
	extraConfig?: Partial<MomentumConfig>,
): MomentumConfig {
	return {
		collections: collections ?? [mockPostsCollection, mockUsersCollection, mockCollectionWithHooks],
		db: { adapter: createMockAdapter() },
		server: { port: 4000 },
		...extraConfig,
	};
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function setupMomentumAPI(config?: MomentumConfig) {
	resetMomentumAPI();
	const cfg = config ?? createTestConfig();
	const api = initializeMomentumAPI(cfg);
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test helper cast
	return { api, config: cfg, adapter: cfg.db.adapter as DatabaseAdapter };
}
