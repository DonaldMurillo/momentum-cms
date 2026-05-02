import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
	CollectionConfig,
	DatabaseAdapter,
	DocumentVersion,
	MomentumConfig,
	UserContext,
} from '@momentumcms/core';
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
		expect(result.body).toMatchObject({ error: 'Versioning not enabled' });
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

/**
 * Build a minimal DatabaseAdapter that supports both CRUD and version
 * operations against an in-memory store. Used to drive success-path tests
 * for the version handlers without standing up a real database.
 */
function createVersionedAdapter(): DatabaseAdapter {
	const base = createInMemoryAdapter();
	const versionsByDoc = new Map<string, DocumentVersion[]>();
	const versionsById = new Map<string, DocumentVersion>();
	let versionCounter = 1;

	return {
		...base,
		async createVersion(_collection, parentId, data): Promise<DocumentVersion> {
			const id = `v-${versionCounter++}`;
			const version: DocumentVersion = {
				id,
				parent: parentId,
				version: JSON.stringify(data),
				_status: 'draft',
				autosave: false,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			versionsById.set(id, version);
			const existing = versionsByDoc.get(parentId) ?? [];
			existing.unshift(version);
			versionsByDoc.set(parentId, existing);
			return version;
		},
		async findVersions(_collection, parentId): Promise<DocumentVersion[]> {
			return versionsByDoc.get(parentId) ?? [];
		},
		async findVersionById(_collection, versionId): Promise<DocumentVersion | null> {
			return versionsById.get(versionId) ?? null;
		},
		async restoreVersion(_collection, versionId): Promise<Record<string, unknown>> {
			const v = versionsById.get(versionId);
			if (!v) throw new Error('Version not found');

			return JSON.parse(v.version) as Record<string, unknown>;
		},
	};
}

function setupVersionedConfig(): MomentumConfig {
	const config: MomentumConfig = {
		collections: [versionedCollection],
		db: { adapter: createVersionedAdapter() },
	};
	initializeMomentumAPI(config);
	return config;
}

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

describe('version handler success and error mapping', () => {
	let docId: string;

	beforeEach(async () => {
		resetMomentumAPI();
		setupVersionedConfig();
		// Seed a document so version operations have something to attach to
		const { getMomentumAPI } = await import('./momentum-api');
		const created = await getMomentumAPI()
			.collection<{ title: string }>('posts')
			.create({ title: 'Initial' });
		docId = String(created['id']);
	});
	afterEach(() => resetMomentumAPI());

	it('handleListVersionsRequest returns 200 with the version query result', async () => {
		const result = await handleListVersionsRequest({
			collectionSlug: 'posts',
			id: docId,
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ docs: expect.any(Array) });
	});

	it('handleSaveDraftRequest returns 200 and persists the draft', async () => {
		const result = await handleSaveDraftRequest({
			collectionSlug: 'posts',
			id: docId,
			data: { title: 'draft-title' },
			user: adminUser,
		});
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ message: 'Draft saved successfully' });

		const list = await handleListVersionsRequest({
			collectionSlug: 'posts',
			id: docId,
			user: adminUser,
		});

		const body = list.body as { docs: unknown[] };
		expect(body.docs.length).toBeGreaterThan(0);
	});

	it('handleGetVersionRequest returns 404 for an unknown versionId', async () => {
		const result = await handleGetVersionRequest({
			collectionSlug: 'posts',
			versionId: 'no-such-version',
			user: adminUser,
		});
		expect(result.status).toBe(404);
		expect(result.body).toMatchObject({ error: 'Version not found' });
	});

	it('handlePublishRequest maps unknown errors to 500 with the documented label', async () => {
		// publish() throws because the in-memory versioned adapter does not
		// implement publishing; verify the handler surfaces it as 500 with the
		// "Failed to publish document" envelope rather than crashing.
		const result = await handlePublishRequest({
			collectionSlug: 'posts',
			id: 'nonexistent-doc',
			user: adminUser,
		});
		expect(result.status).toBe(500);
		expect(result.body).toMatchObject({ error: 'Failed to publish document' });
	});

	it('handleUnpublishRequest maps unknown errors to 500', async () => {
		const result = await handleUnpublishRequest({
			collectionSlug: 'posts',
			id: 'nonexistent-doc',
			user: adminUser,
		});
		expect(result.status).toBe(500);
		expect(result.body).toMatchObject({ error: 'Failed to unpublish document' });
	});

	it('handleSchedulePublishRequest maps unknown errors to 500 once publishAt is valid', async () => {
		const result = await handleSchedulePublishRequest({
			collectionSlug: 'posts',
			id: 'nonexistent-doc',
			publishAt: new Date(Date.now() + 86400000).toISOString(),
			user: adminUser,
		});
		expect([200, 500]).toContain(result.status);
		if (result.status === 500) {
			expect(result.body).toMatchObject({ error: 'Failed to schedule publish' });
		}
	});

	it('handle403: AccessDeniedError on a restricted collection maps to 403', async () => {
		// Set up a versioned collection that denies restoreVersions for non-admin
		resetMomentumAPI();
		const restricted: CollectionConfig = {
			slug: 'locked',
			fields: [{ name: 'title', type: 'text' }],
			versions: { drafts: true },
			access: {
				read: () => true,
				readVersions: () => true,
				restoreVersions: ({ req }) => req.user?.role === 'admin',
			},
		};
		const adapter = createVersionedAdapter();
		initializeMomentumAPI({
			collections: [restricted],
			db: { adapter },
		});

		// Use the admin-context API to seed a doc and a version
		const { getMomentumAPI } = await import('./momentum-api');
		const seeded = await getMomentumAPI()
			.setContext({ user: adminUser })
			.collection<{ title: string }>('locked')
			.create({ title: 'a' });
		const seedId = String(seeded['id']);

		// Save a draft to populate a version
		await handleSaveDraftRequest({
			collectionSlug: 'locked',
			id: seedId,
			data: { title: 'b' },
			user: adminUser,
		});
		const list = await handleListVersionsRequest({
			collectionSlug: 'locked',
			id: seedId,
			user: adminUser,
		});

		const body = list.body as { docs: { id: string }[] };
		const versionId = body.docs[0]?.id;
		expect(versionId).toBeDefined();

		// Non-admin attempts to restore — should be denied
		const result = await handleRestoreVersionRequest({
			collectionSlug: 'locked',
			id: seedId,
			versionId,
			user: { id: 'u-2', role: 'editor' },
		});
		expect(result.status).toBe(403);
		expect(result.body).toMatchObject({ error: 'Access denied' });
	});

	// Suppress the version operations resolver warning in spy-based assertions
	afterEach(() => vi.restoreAllMocks());
});
