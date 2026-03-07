import { request as playwrightRequest } from '@playwright/test';
import {
	test,
	expect,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
} from '../fixtures';

/**
 * Multi-User Versioning & Drafts E2E Tests
 *
 * Tests role-based access control for the versioning workflow:
 * - Admin: full control (create, update, delete, publish, unpublish, restore)
 * - Editor: can create and update (draft), view versions, cannot publish/restore
 * - Viewer: can read, view versions, cannot create/update/publish
 *
 * All tests use real API calls against a live server — no mocks.
 */

/** Helper to create a signed-in API request context for a user. */
async function signIn(
	baseURL: string,
	credentials: { email: string; password: string },
): Promise<ReturnType<typeof playwrightRequest.newContext> extends Promise<infer R> ? R : never> {
	const ctx = await playwrightRequest.newContext({ baseURL });
	const response = await ctx.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: { email: credentials.email, password: credentials.password },
	});
	if (!response.ok()) {
		throw new Error(`Sign-in failed for ${credentials.email}: ${response.status()}`);
	}
	return ctx;
}

test.describe(
	'Multi-user versioning workflow',
	{ tag: ['@versioning', '@multi-user', '@api'] },
	() => {
		let adminCtx: Awaited<ReturnType<typeof signIn>>;
		let editorCtx: Awaited<ReturnType<typeof signIn>>;
		let viewerCtx: Awaited<ReturnType<typeof signIn>>;

		test.beforeAll(async ({ workerBaseURL }) => {
			const baseURL = workerBaseURL;
			adminCtx = await signIn(baseURL, TEST_CREDENTIALS);
			editorCtx = await signIn(baseURL, TEST_EDITOR_CREDENTIALS);
			viewerCtx = await signIn(baseURL, TEST_VIEWER_CREDENTIALS);
		});

		test.afterAll(async () => {
			// Clean up test articles (prefix MV- for easy identification)
			const listResponse = await adminCtx.get('/api/articles?limit=1000');
			if (listResponse.ok()) {
				const listData = (await listResponse.json()) as {
					docs: Array<{ id: string; title?: string }>;
				};
				for (const doc of listData.docs) {
					if (doc.title?.startsWith('MV-')) {
						await adminCtx.delete(`/api/articles/${doc.id}`);
					}
				}
			}
			await adminCtx.dispose();
			await editorCtx.dispose();
			await viewerCtx.dispose();
		});

		test('editor creates article as draft, admin publishes', async () => {
			// Editor creates an article — should default to draft status
			const createResponse = await editorCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Editor Draft', content: '<p>Editor content</p>' },
			});
			expect(createResponse.status(), 'Editor should be able to create articles').toBe(201);

			const created = (await createResponse.json()) as { doc: { id: string } };
			const articleId = created.doc.id;

			// Verify default status is draft via status endpoint
			const draftStatus = await editorCtx.get(`/api/articles/${articleId}/status`);
			expect(draftStatus.ok()).toBe(true);
			const draftData = (await draftStatus.json()) as { status: string };
			expect(draftData.status).toBe('draft');

			// Editor tries to publish — should be denied
			const editorPublish = await editorCtx.post(`/api/articles/${articleId}/publish`);
			expect(editorPublish.status(), 'Editor should not be able to publish').toBe(403);

			// Admin publishes the article
			const adminPublish = await adminCtx.post(`/api/articles/${articleId}/publish`);
			expect(adminPublish.ok(), 'Admin should be able to publish').toBe(true);

			// Verify status changed to published
			const statusResponse = await editorCtx.get(`/api/articles/${articleId}/status`);
			expect(statusResponse.ok()).toBe(true);
			const statusData = (await statusResponse.json()) as { status: string };
			expect(statusData.status).toBe('published');
		});

		test('viewer cannot create or update articles', async () => {
			// Viewer tries to create — should be denied
			const viewerCreate = await viewerCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Viewer Attempt' },
			});
			expect(viewerCreate.status(), 'Viewer should not be able to create').toBe(403);

			// Admin creates an article for testing
			const adminCreate = await adminCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Admin Created', content: '<p>Admin content</p>' },
			});
			expect(adminCreate.status()).toBe(201);
			const created = (await adminCreate.json()) as { doc: { id: string } };

			// Viewer tries to update — should be denied
			const viewerUpdate = await viewerCtx.patch(`/api/articles/${created.doc.id}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Viewer Edit' },
			});
			expect(viewerUpdate.status(), 'Viewer should not be able to update').toBe(403);

			// Viewer cannot read draft articles (only published)
			const viewerReadDraft = await viewerCtx.get(`/api/articles/${created.doc.id}`);
			expect(viewerReadDraft.ok()).toBe(true);
			const draftData = (await viewerReadDraft.json()) as { doc: unknown };
			expect(draftData.doc, 'Viewer should not see draft article').toBeNull();

			// Publish the article, then viewer can read it
			const publishRes = await adminCtx.post(`/api/articles/${created.doc.id}/publish`);
			expect(publishRes.ok(), 'Admin publish must succeed').toBe(true);

			const viewerRead = await viewerCtx.get(`/api/articles/${created.doc.id}`);
			expect(viewerRead.ok(), 'Viewer should be able to read published article').toBe(true);
			const readData = (await viewerRead.json()) as { doc: { title: string } };
			expect(readData.doc.title).toBe('MV-Admin Created');
		});

		test('editor saves drafts, admin publishes', async () => {
			// Editor creates article
			const createResponse = await editorCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Draft Flow', content: '<p>Initial</p>' },
			});
			expect(createResponse.status()).toBe(201);
			const created = (await createResponse.json()) as { doc: { id: string } };
			const articleId = created.doc.id;

			// Editor saves a draft
			const draftResponse = await editorCtx.post(`/api/articles/${articleId}/draft`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Draft Flow Updated', content: '<p>Draft update</p>' },
			});
			expect(draftResponse.ok(), 'Editor should be able to save drafts').toBe(true);

			// Editor tries to publish — denied
			const editorPublish = await editorCtx.post(`/api/articles/${articleId}/publish`);
			expect(editorPublish.status()).toBe(403);

			// Admin publishes
			const adminPublish = await adminCtx.post(`/api/articles/${articleId}/publish`);
			expect(adminPublish.ok()).toBe(true);

			// Verify versions exist (draft + published)
			const versionsResponse = await editorCtx.get(
				`/api/articles/${articleId}/versions?limit=10&includeAutosave=true`,
			);
			expect(versionsResponse.ok()).toBe(true);
			const versionsData = (await versionsResponse.json()) as {
				docs: Array<{ _status: string; autosave: boolean }>;
			};
			expect(versionsData.docs.length).toBeGreaterThanOrEqual(1);

			// Should have at least one published version
			const publishedVersions = versionsData.docs.filter((v) => v._status === 'published');
			expect(publishedVersions.length).toBeGreaterThanOrEqual(1);
		});

		test('admin restores version, editor cannot', async () => {
			// Admin creates and publishes an article
			const createResponse = await adminCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Restore Test', content: '<p>Version 1</p>' },
			});
			expect(createResponse.status()).toBe(201);
			const created = (await createResponse.json()) as { doc: { id: string } };
			const articleId = created.doc.id;

			// Publish first version
			const publish1 = await adminCtx.post(`/api/articles/${articleId}/publish`);
			expect(publish1.ok(), 'First publish must succeed').toBe(true);

			// Update to create new state
			const update1 = await adminCtx.patch(`/api/articles/${articleId}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Restore Test V2', content: '<p>Version 2</p>' },
			});
			expect(update1.ok(), 'Update must succeed').toBe(true);

			// Publish second version
			const publish2 = await adminCtx.post(`/api/articles/${articleId}/publish`);
			expect(publish2.ok(), 'Second publish must succeed').toBe(true);

			// Get versions to find one to restore
			const versionsResponse = await adminCtx.get(`/api/articles/${articleId}/versions?limit=10`);
			const versionsData = (await versionsResponse.json()) as {
				docs: Array<{ id: string; _status: string }>;
			};
			expect(versionsData.docs.length).toBeGreaterThanOrEqual(2);

			// Pick the older version (not the most recent)
			const olderVersion = versionsData.docs[versionsData.docs.length - 1];

			// Editor tries to restore — denied
			const editorRestore = await editorCtx.post(`/api/articles/${articleId}/versions/restore`, {
				headers: { 'Content-Type': 'application/json' },
				data: { versionId: olderVersion.id },
			});
			expect(editorRestore.status(), 'Editor should not be able to restore versions').toBe(403);

			// Admin restores
			const adminRestore = await adminCtx.post(`/api/articles/${articleId}/versions/restore`, {
				headers: { 'Content-Type': 'application/json' },
				data: { versionId: olderVersion.id },
			});
			expect(adminRestore.ok(), 'Admin should be able to restore versions').toBe(true);

			// Verify content actually reverted to V1
			const restoredArticle = await adminCtx.get(`/api/articles/${articleId}`);
			expect(restoredArticle.ok()).toBe(true);
			const restoredData = (await restoredArticle.json()) as { doc: { title: string } };
			expect(restoredData.doc.title, 'Title should revert to original').toBe('MV-Restore Test');
		});

		test('version history accessible to all authenticated users', async () => {
			// Admin creates and publishes
			const createResponse = await adminCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-History Access', content: '<p>Shared content</p>' },
			});
			expect(createResponse.status()).toBe(201);
			const created = (await createResponse.json()) as { doc: { id: string } };
			const articleId = created.doc.id;

			const publishRes = await adminCtx.post(`/api/articles/${articleId}/publish`);
			expect(publishRes.ok(), 'Publish must succeed').toBe(true);

			// Editor can read versions
			const editorVersions = await editorCtx.get(`/api/articles/${articleId}/versions`);
			expect(editorVersions.ok(), 'Editor should be able to read version history').toBe(true);

			// Viewer can read versions
			const viewerVersions = await viewerCtx.get(`/api/articles/${articleId}/versions`);
			expect(viewerVersions.ok(), 'Viewer should be able to read version history').toBe(true);
		});

		test('admin unpublishes, status reverts to draft', async () => {
			// Admin creates and publishes
			const createResponse = await adminCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Unpublish Test' },
			});
			expect(createResponse.status()).toBe(201);
			const created = (await createResponse.json()) as { doc: { id: string } };
			const articleId = created.doc.id;

			// Publish
			const publishResponse = await adminCtx.post(`/api/articles/${articleId}/publish`);
			expect(publishResponse.ok()).toBe(true);

			// Verify published
			let statusResponse = await adminCtx.get(`/api/articles/${articleId}/status`);
			let statusData = (await statusResponse.json()) as { status: string };
			expect(statusData.status).toBe('published');

			// Editor tries to unpublish — denied
			const editorUnpublish = await editorCtx.post(`/api/articles/${articleId}/unpublish`);
			expect(editorUnpublish.status(), 'Editor should not be able to unpublish').toBe(403);

			// Admin unpublishes
			const unpublishResponse = await adminCtx.post(`/api/articles/${articleId}/unpublish`);
			expect(unpublishResponse.ok()).toBe(true);

			// Verify status reverted to draft
			statusResponse = await adminCtx.get(`/api/articles/${articleId}/status`);
			statusData = (await statusResponse.json()) as { status: string };
			expect(statusData.status).toBe('draft');
		});

		test('auto-versioning creates history on update', async () => {
			// Admin creates article
			const createResponse = await adminCtx.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Auto Version', content: '<p>Initial</p>' },
			});
			expect(createResponse.status()).toBe(201);
			const created = (await createResponse.json()) as { doc: { id: string } };
			const articleId = created.doc.id;

			// Update the article multiple times to generate versions
			const patch1 = await adminCtx.patch(`/api/articles/${articleId}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Auto Version v2' },
			});
			expect(patch1.ok(), 'First update must succeed').toBe(true);

			const patch2 = await adminCtx.patch(`/api/articles/${articleId}`, {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'MV-Auto Version v3' },
			});
			expect(patch2.ok(), 'Second update must succeed').toBe(true);

			// Verify version history was auto-created
			const versionsResponse = await adminCtx.get(`/api/articles/${articleId}/versions?limit=10`);
			expect(versionsResponse.ok()).toBe(true);
			const versionsData = (await versionsResponse.json()) as {
				docs: Array<{ id: string; version: Record<string, unknown> }>;
			};

			// Should have at least 2 versions from the 2 updates
			expect(versionsData.docs.length).toBeGreaterThanOrEqual(2);
		});
	},
);
