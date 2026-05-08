import { createInMemoryAdapter } from '@momentumcms/server-core';
import type { CollectionConfig, MomentumConfig } from '@momentumcms/core';

export const versionedCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
	versions: { drafts: true },
};

export const unversionedCollection: CollectionConfig = {
	slug: 'tags',
	fields: [{ name: 'name', type: 'text' }],
};

export function createTestConfig(collections: CollectionConfig[]): MomentumConfig {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal in-memory config for controller tests
	return {
		collections,
		db: { adapter: createInMemoryAdapter() },
	} as MomentumConfig;
}
