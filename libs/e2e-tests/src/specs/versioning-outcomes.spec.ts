import { request as playwrightRequest } from '@playwright/test';
import {
	test,
	expect,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
} from '../fixtures';

/**
 * Versioning Outcomes E2E Tests
 *
 * Tests what versioning actually guarantees from a user's perspective:
 * - Drafts are invisible to anonymous users AND authenticated viewers
 * - Drafts are visible to admins and editors (users with update access)
 * - Publishing makes content live; unpublishing hides it again
 * - Restoring a version gives back the EXACT content from that point
 * - Version snapshots capture all fields, not just metadata
 *
 * All tests use real API calls against a live server — no mocks.
 */

/** Create an authenticated API context for a user. */
async function signedInContext(baseURL: string, credentials: { email: string; password: string }) {
	const ctx = await playwrightRequest.newContext({ baseURL });
	const res = await ctx.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: { email: credentials.email, password: credentials.password },
	});
	if (!res.ok()) throw new Error(`Sign-in failed for ${credentials.email}: ${res.status()}`);
	return ctx;
}

test.describe('Versioning outcomes', { tag: ['@versioning', '@api'] }, () => {
	let admin: Awaited<ReturnType<typeof signedInContext>>;
	let editor: Awaited<ReturnType<typeof signedInContext>>;
	let viewer: Awaited<ReturnType<typeof signedInContext>>;
	let anon: Awaited<ReturnType<typeof signedInContext>>;

	test.beforeAll(async ({ workerBaseURL }) => {
		admin = await signedInContext(workerBaseURL, TEST_CREDENTIALS);
		editor = await signedInContext(workerBaseURL, TEST_EDITOR_CREDENTIALS);
		viewer = await signedInContext(workerBaseURL, TEST_VIEWER_CREDENTIALS);
		anon = await playwrightRequest.newContext({ baseURL: workerBaseURL });
	});

	test.afterAll(async () => {
		// Clean up test articles prefixed with VO-
		const listRes = await admin.get('/api/articles?limit=1000');
		if (listRes.ok()) {
			const data = (await listRes.json()) as { docs: Array<{ id: string; title?: string }> };
			for (const doc of data.docs) {
				if (doc.title?.startsWith('VO-')) {
					await admin.delete(`/api/articles/${doc.id}`);
				}
			}
		}
		await admin.dispose();
		await editor.dispose();
		await viewer.dispose();
		await anon.dispose();
	});

	test('draft article is invisible to anonymous users', async () => {
		// Admin creates a draft article
		const createRes = await admin.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VO-Secret Draft', content: '<p>Not ready for public eyes</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		const articleId = created.doc.id;

		// Verify it's a draft
		const statusRes = await admin.get(`/api/articles/${articleId}/status`);
		const statusData = (await statusRes.json()) as { status: string };
		expect(statusData.status).toBe('draft');

		// Anonymous user cannot see it by ID
		const anonGetRes = await anon.get(`/api/articles/${articleId}`);
		// Should return 200 with null doc — draft content must not leak
		expect(anonGetRes.ok()).toBe(true);
		const anonData = (await anonGetRes.json()) as { doc: unknown };
		expect(anonData.doc, 'Anonymous should not see draft article by ID').toBeNull();

		// Anonymous user cannot find it in the list
		const anonListRes = await anon.get('/api/articles?limit=1000');
		expect(anonListRes.ok()).toBe(true);
		const anonList = (await anonListRes.json()) as { docs: Array<{ id: string }> };
		const found = anonList.docs.find((d) => d.id === articleId);
		expect(found, 'Draft article should not appear in anonymous article list').toBeUndefined();
	});

	test('publishing makes content visible to anonymous users', async () => {
		// Admin creates and publishes
		const createRes = await admin.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VO-Public Article', content: '<p>Ready for the world</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		const articleId = created.doc.id;

		// Before publish: anonymous can't see it
		const beforeList = await anon.get('/api/articles?limit=1000');
		const beforeDocs = (await beforeList.json()) as { docs: Array<{ id: string }> };
		expect(beforeDocs.docs.find((d) => d.id === articleId)).toBeUndefined();

		// Publish
		const publishRes = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publishRes.ok(), 'Publish must succeed').toBe(true);

		// After publish: anonymous CAN see it
		const afterGet = await anon.get(`/api/articles/${articleId}`);
		expect(afterGet.ok(), 'Anonymous should see published article').toBe(true);
		const afterData = (await afterGet.json()) as { doc: { id: string; title: string } };
		expect(afterData.doc.id).toBe(articleId);
		expect(afterData.doc.title).toBe('VO-Public Article');

		// Also visible in list
		const afterList = await anon.get('/api/articles?limit=1000');
		const afterDocs = (await afterList.json()) as { docs: Array<{ id: string }> };
		expect(afterDocs.docs.find((d) => d.id === articleId)).toBeDefined();
	});

	test('unpublishing hides content from anonymous users again', async () => {
		// Create and publish
		const createRes = await admin.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VO-Unpublish Test', content: '<p>Now you see me</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		const articleId = created.doc.id;

		const publishRes = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publishRes.ok()).toBe(true);

		// Confirm visible
		const visibleRes = await anon.get(`/api/articles/${articleId}`);
		expect(visibleRes.ok()).toBe(true);

		// Unpublish
		const unpublishRes = await admin.post(`/api/articles/${articleId}/unpublish`);
		expect(unpublishRes.ok()).toBe(true);

		// Now hidden from anonymous
		const hiddenRes = await anon.get(`/api/articles/${articleId}`);
		expect(hiddenRes.ok()).toBe(true);
		const hiddenData = (await hiddenRes.json()) as { doc: unknown };
		expect(hiddenData.doc, 'Unpublished article should be hidden from anonymous').toBeNull();

		// Hidden from list too
		const listRes = await anon.get('/api/articles?limit=1000');
		const listData = (await listRes.json()) as { docs: Array<{ id: string }> };
		expect(listData.docs.find((d) => d.id === articleId)).toBeUndefined();
	});

	test('version snapshots capture exact content for full round-trip restore', async () => {
		// Create article with specific fields
		const v1 = { title: 'VO-Roundtrip V1', content: '<p>First version content</p>' };
		const createRes = await admin.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: v1,
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		const articleId = created.doc.id;

		// Publish V1 to create a version snapshot
		const publishV1 = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publishV1.ok()).toBe(true);

		// Get the version list — should have at least one entry
		const versionsAfterV1 = await admin.get(`/api/articles/${articleId}/versions?limit=10`);
		expect(versionsAfterV1.ok()).toBe(true);
		const v1Versions = (await versionsAfterV1.json()) as {
			docs: Array<{ id: string; version: Record<string, unknown>; _status: string }>;
		};
		expect(v1Versions.docs.length).toBeGreaterThanOrEqual(1);

		// Verify V1 snapshot has the exact content we created
		const v1Snapshot = v1Versions.docs[0];
		expect(v1Snapshot.version['title']).toBe(v1.title);
		expect(v1Snapshot.version['content']).toBe(v1.content);

		// Update to V2 — different content entirely
		const v2 = {
			title: 'VO-Roundtrip V2',
			content: '<p>Second version — completely different</p>',
		};
		const updateRes = await admin.patch(`/api/articles/${articleId}`, {
			headers: { 'Content-Type': 'application/json' },
			data: v2,
		});
		expect(updateRes.ok()).toBe(true);

		// Publish V2
		const publishV2 = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publishV2.ok()).toBe(true);

		// Verify current state is V2
		const currentRes = await admin.get(`/api/articles/${articleId}`);
		expect(currentRes.ok()).toBe(true);
		const currentData = (await currentRes.json()) as { doc: { title: string; content: string } };
		expect(currentData.doc.title).toBe(v2.title);
		expect(currentData.doc.content).toBe(v2.content);

		// Update to V3
		const v3 = { title: 'VO-Roundtrip V3', content: '<p>Third version — yet another rewrite</p>' };
		const updateV3 = await admin.patch(`/api/articles/${articleId}`, {
			headers: { 'Content-Type': 'application/json' },
			data: v3,
		});
		expect(updateV3.ok()).toBe(true);

		// Now restore to V1 snapshot
		const allVersions = await admin.get(`/api/articles/${articleId}/versions?limit=20`);
		const allVersionsData = (await allVersions.json()) as {
			docs: Array<{ id: string; version: Record<string, unknown> }>;
		};

		// Find the version that matches V1 content
		const v1Version = allVersionsData.docs.find(
			(v) => v.version['title'] === v1.title && v.version['content'] === v1.content,
		);
		if (!v1Version) throw new Error('V1 version not found in history');

		// Restore it
		const restoreRes = await admin.post(`/api/articles/${articleId}/versions/restore`, {
			headers: { 'Content-Type': 'application/json' },
			data: { versionId: v1Version.id },
		});
		expect(restoreRes.ok(), 'Restore must succeed').toBe(true);

		// Verify the article now has EXACTLY V1's content — every field
		const restoredRes = await admin.get(`/api/articles/${articleId}`);
		expect(restoredRes.ok()).toBe(true);
		const restoredData = (await restoredRes.json()) as { doc: { title: string; content: string } };
		expect(restoredData.doc.title, 'Title should be exactly V1').toBe(v1.title);
		expect(restoredData.doc.content, 'Content should be exactly V1').toBe(v1.content);
	});

	test('admin and editor see drafts, viewer does not', async () => {
		// Admin creates a draft article
		const createRes = await admin.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VO-Role Visibility', content: '<p>Who can see this?</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		const articleId = created.doc.id;

		// Admin can see it by ID
		const adminGet = await admin.get(`/api/articles/${articleId}`);
		expect(adminGet.ok()).toBe(true);
		const adminData = (await adminGet.json()) as { doc: { id: string; title: string } };
		expect(adminData.doc.title).toBe('VO-Role Visibility');

		// Editor can see it by ID (editors have update access)
		const editorGet = await editor.get(`/api/articles/${articleId}`);
		expect(editorGet.ok()).toBe(true);
		const editorData = (await editorGet.json()) as { doc: { id: string; title: string } };
		expect(editorData.doc.title).toBe('VO-Role Visibility');

		// Viewer CANNOT see it by ID (viewers only have read access, no update)
		const viewerGet = await viewer.get(`/api/articles/${articleId}`);
		expect(viewerGet.ok()).toBe(true);
		const viewerData = (await viewerGet.json()) as { doc: unknown };
		expect(viewerData.doc, 'Viewer should not see draft article').toBeNull();

		// Viewer CANNOT find it in list
		const viewerList = await viewer.get('/api/articles?limit=1000');
		expect(viewerList.ok()).toBe(true);
		const viewerListData = (await viewerList.json()) as { docs: Array<{ id: string }> };
		expect(
			viewerListData.docs.find((d) => d.id === articleId),
			'Draft should not appear in viewer list',
		).toBeUndefined();

		// Editor CAN find it in list
		const editorList = await editor.get('/api/articles?limit=1000');
		expect(editorList.ok()).toBe(true);
		const editorListData = (await editorList.json()) as { docs: Array<{ id: string }> };
		expect(
			editorListData.docs.find((d) => d.id === articleId),
			'Draft should appear in editor list',
		).toBeDefined();

		// Anonymous CANNOT see it either
		const anonGet = await anon.get(`/api/articles/${articleId}`);
		expect(anonGet.ok()).toBe(true);
		const anonData2 = (await anonGet.json()) as { doc: unknown };
		expect(anonData2.doc, 'Anonymous should not see draft article').toBeNull();
	});

	test('viewer sees article after it is published', async () => {
		// Admin creates and publishes
		const createRes = await admin.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'VO-Viewer Published', content: '<p>Published for everyone</p>' },
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		const articleId = created.doc.id;

		// Before publish: viewer can't see it
		const beforeGet = await viewer.get(`/api/articles/${articleId}`);
		expect(beforeGet.ok()).toBe(true);
		const beforeData = (await beforeGet.json()) as { doc: unknown };
		expect(beforeData.doc, 'Viewer should not see unpublished article').toBeNull();

		// Publish
		const publishRes = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publishRes.ok()).toBe(true);

		// After publish: viewer CAN see it
		const afterGet = await viewer.get(`/api/articles/${articleId}`);
		expect(afterGet.ok()).toBe(true);
		const afterData = (await afterGet.json()) as { doc: { title: string } };
		expect(afterData.doc.title).toBe('VO-Viewer Published');
	});

	test('version history preserves chronological edit trail', async () => {
		const edits = [
			{ title: 'VO-Trail Step 1', content: '<p>First edit</p>' },
			{ title: 'VO-Trail Step 2', content: '<p>Second edit</p>' },
			{ title: 'VO-Trail Step 3', content: '<p>Third edit</p>' },
		];

		// Create article with first edit
		const createRes = await admin.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: edits[0],
		});
		expect(createRes.status()).toBe(201);
		const created = (await createRes.json()) as { doc: { id: string } };
		const articleId = created.doc.id;

		// Publish after each edit to create version snapshots
		const publish1 = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publish1.ok()).toBe(true);

		// Edit 2
		const update2 = await admin.patch(`/api/articles/${articleId}`, {
			headers: { 'Content-Type': 'application/json' },
			data: edits[1],
		});
		expect(update2.ok()).toBe(true);
		const publish2 = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publish2.ok()).toBe(true);

		// Edit 3
		const update3 = await admin.patch(`/api/articles/${articleId}`, {
			headers: { 'Content-Type': 'application/json' },
			data: edits[2],
		});
		expect(update3.ok()).toBe(true);
		const publish3 = await admin.post(`/api/articles/${articleId}/publish`);
		expect(publish3.ok()).toBe(true);

		// Get full version history
		const versionsRes = await admin.get(`/api/articles/${articleId}/versions?limit=20`);
		expect(versionsRes.ok()).toBe(true);
		const versionsData = (await versionsRes.json()) as {
			docs: Array<{ id: string; version: Record<string, unknown>; createdAt: string }>;
		};

		// Should have at least 3 versions (one per publish)
		expect(versionsData.docs.length).toBeGreaterThanOrEqual(3);

		// Every edit should appear somewhere in the version history
		for (const edit of edits) {
			const found = versionsData.docs.find(
				(v) => v.version['title'] === edit.title && v.version['content'] === edit.content,
			);
			expect(found, `Version history should contain "${edit.title}"`).toBeDefined();
		}

		// Versions should be in chronological order (newest first)
		for (let i = 0; i < versionsData.docs.length - 1; i++) {
			const current = new Date(versionsData.docs[i].createdAt).getTime();
			const next = new Date(versionsData.docs[i + 1].createdAt).getTime();
			expect(current, 'Versions should be sorted newest first').toBeGreaterThanOrEqual(next);
		}
	});
});
