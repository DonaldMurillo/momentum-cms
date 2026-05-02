import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CollectionConfig, MomentumConfig, UserContext } from '@momentumcms/core';
import {
	handleListVersionsRequest,
	handleGetVersionRequest,
	handleRestoreVersionRequest,
	handleCompareVersionsRequest,
	handlePublishRequest,
	handleUnpublishRequest,
	handleSaveDraftRequest,
	handleSchedulePublishRequest,
	handleCancelScheduledPublishRequest,
} from './version-handlers';
import { initializeMomentumAPI, resetMomentumAPI } from './momentum-api';
import { createInMemoryAdapter } from './server-core';

const adminUser: UserContext = { id: 'u-admin', role: 'admin' };

const versionedCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
	versions: { drafts: true },
};

const unversionedCollection: CollectionConfig = {
	slug: 'tags',
	fields: [{ name: 'name', type: 'text' }],
};

function setupConfig(): MomentumConfig {
	const config: MomentumConfig = {
		collections: [versionedCollection, unversionedCollection],
		db: { adapter: createInMemoryAdapter() },
	};
	initializeMomentumAPI(config);
	return config;
}

describe('handleListVersionsRequest', () => {
	beforeEach(() => {
		resetMomentumAPI();
		setupConfig();
	});
	afterEach(() => resetMomentumAPI());

	it('returns 400 when versioning is not enabled', async () => {
		const result = await handleListVersionsRequest({
			collectionSlug: 'tags',
			id: '1',
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Versioning not enabled' });
	});

	// Success-path version listing exercises the adapter-level findVersions
	// query; that's covered by version-operations.spec.ts. The handler-level
	// test focuses on the validation and error-mapping branches.
});

describe('handleGetVersionRequest', () => {
	beforeEach(() => {
		resetMomentumAPI();
		setupConfig();
	});
	afterEach(() => resetMomentumAPI());

	it('returns 400 when versioning is not enabled', async () => {
		const result = await handleGetVersionRequest({
			collectionSlug: 'tags',
			versionId: 'v-1',
			user: adminUser,
		});
		expect(result.status).toBe(400);
	});

	// 404 paths through findVersionById are exercised by version-operations.spec.ts.
});

describe('handleRestoreVersionRequest', () => {
	beforeEach(() => {
		resetMomentumAPI();
		setupConfig();
	});
	afterEach(() => resetMomentumAPI());

	it('returns 400 when versionId is missing', async () => {
		const result = await handleRestoreVersionRequest({
			collectionSlug: 'posts',
			id: 'doc-1',
			versionId: undefined,
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Invalid request' });
	});

	it('returns 400 when versioning is not enabled', async () => {
		const result = await handleRestoreVersionRequest({
			collectionSlug: 'tags',
			id: 'doc-1',
			versionId: 'v-1',
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Versioning not enabled' });
	});
});

describe('handleCompareVersionsRequest', () => {
	beforeEach(() => {
		resetMomentumAPI();
		setupConfig();
	});
	afterEach(() => resetMomentumAPI());

	it('returns 400 when either version ID is missing', async () => {
		const result = await handleCompareVersionsRequest({
			collectionSlug: 'posts',
			id: 'doc-1',
			versionId1: 'v-1',
			versionId2: undefined,
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Missing version IDs' });
	});

	it('returns 400 when versioning is not enabled', async () => {
		const result = await handleCompareVersionsRequest({
			collectionSlug: 'tags',
			id: 'doc-1',
			versionId1: 'v-1',
			versionId2: 'v-2',
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Versioning not enabled' });
	});
});

describe('publishing handler validation', () => {
	beforeEach(() => {
		resetMomentumAPI();
		setupConfig();
	});
	afterEach(() => resetMomentumAPI());

	it('handlePublishRequest returns 400 when versioning is not enabled', async () => {
		const result = await handlePublishRequest({
			collectionSlug: 'tags',
			id: '1',
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Versioning not enabled' });
	});

	it('handleUnpublishRequest returns 400 when versioning is not enabled', async () => {
		const result = await handleUnpublishRequest({
			collectionSlug: 'tags',
			id: '1',
			user: adminUser,
		});
		expect(result.status).toBe(400);
	});

	it('handleSaveDraftRequest returns 400 when versioning is not enabled', async () => {
		const result = await handleSaveDraftRequest({
			collectionSlug: 'tags',
			id: '1',
			data: { title: 'x' },
			user: adminUser,
		});
		expect(result.status).toBe(400);
	});

	it('handleSchedulePublishRequest returns 400 when publishAt is missing', async () => {
		const result = await handleSchedulePublishRequest({
			collectionSlug: 'posts',
			id: '1',
			publishAt: undefined,
			user: adminUser,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Missing publishAt' });
	});

	it('handleSchedulePublishRequest returns 400 for non-string publishAt', async () => {
		const result = await handleSchedulePublishRequest({
			collectionSlug: 'posts',
			id: '1',
			publishAt: 12345,
			user: adminUser,
		});
		expect(result.status).toBe(400);
	});

	it('handleCancelScheduledPublishRequest returns 400 when versioning is not enabled', async () => {
		const result = await handleCancelScheduledPublishRequest({
			collectionSlug: 'tags',
			id: '1',
			user: adminUser,
		});
		expect(result.status).toBe(400);
	});
});
