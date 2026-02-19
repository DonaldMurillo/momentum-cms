import {
	test,
	expect,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_AUTHOR1_CREDENTIALS,
} from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * defaultWhere Mutation Enforcement E2E Tests
 *
 * Proves that defaultWhere constraints are enforced on update and delete
 * operations, not just reads. Uses the user-notes collection where:
 * - Any authenticated user can CRUD (access control allows all)
 * - Non-admin users are scoped to their own notes via defaultWhere
 * - Admin users bypass defaultWhere (see all notes)
 *
 * Without the fix, PATCH/DELETE on another user's note would succeed
 * because defaultWhere was only applied to find/findById.
 */

async function signIn(context: APIRequestContext, email: string, password: string): Promise<void> {
	const response = await context.post('/api/auth/sign-in/email', {
		data: { email, password },
	});
	expect(response.ok()).toBe(true);
}

test.describe('defaultWhere mutation enforcement', { tag: ['@api', '@security'] }, () => {
	let editorContext: APIRequestContext;
	let author1Context: APIRequestContext;
	let adminContext: APIRequestContext;
	let editorNoteId: string;
	let author1NoteId: string;

	test.beforeAll(async ({ playwright, workerBaseURL }) => {
		// Create contexts for each user
		editorContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});
		author1Context = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});
		adminContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		// Sign in all users
		await signIn(editorContext, TEST_EDITOR_CREDENTIALS.email, TEST_EDITOR_CREDENTIALS.password);
		await signIn(author1Context, TEST_AUTHOR1_CREDENTIALS.email, TEST_AUTHOR1_CREDENTIALS.password);
		await signIn(adminContext, TEST_CREDENTIALS.email, TEST_CREDENTIALS.password);

		// Editor creates a note
		const editorCreateResponse = await editorContext.post('/api/user-notes', {
			data: { title: 'Editor Private Note' },
		});
		expect(editorCreateResponse.status()).toBe(201);
		const editorNote = (await editorCreateResponse.json()) as { doc: { id: string } };
		editorNoteId = editorNote.doc.id;

		// Author1 creates a note
		const author1CreateResponse = await author1Context.post('/api/user-notes', {
			data: { title: 'Author1 Private Note' },
		});
		expect(author1CreateResponse.status()).toBe(201);
		const author1Note = (await author1CreateResponse.json()) as { doc: { id: string } };
		author1NoteId = author1Note.doc.id;
	});

	test.afterAll(async () => {
		await editorContext?.dispose();
		await author1Context?.dispose();
		await adminContext?.dispose();
	});

	// ============================================
	// Read scoping (baseline — already worked before the fix)
	// ============================================

	test('editor can only see their own notes', async () => {
		const response = await editorContext.get('/api/user-notes');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: Array<{ id: string; ownerId: string }> };
		expect(data.docs.length).toBeGreaterThan(0);

		// All returned docs should belong to editor (not author1)
		for (const doc of data.docs) {
			expect(doc.id).not.toBe(author1NoteId);
		}
	});

	test('editor cannot findById another users note', async () => {
		const response = await editorContext.get(`/api/user-notes/${author1NoteId}`);
		expect(response.status()).toBe(404);
	});

	// ============================================
	// Update scoping (THE FIX — previously not enforced)
	// ============================================

	test('author1 cannot update editors note (defaultWhere blocks)', async () => {
		const response = await author1Context.patch(`/api/user-notes/${editorNoteId}`, {
			data: { title: 'Hijacked by Author1' },
		});
		expect(response.status()).toBe(404);
	});

	test('editor can update their own note', async () => {
		const response = await editorContext.patch(`/api/user-notes/${editorNoteId}`, {
			data: { title: 'Editor Updated Note' },
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { doc: { title: string } };
		expect(data.doc.title).toBe('Editor Updated Note');
	});

	test('admin can update any users note (bypasses defaultWhere)', async () => {
		const response = await adminContext.patch(`/api/user-notes/${author1NoteId}`, {
			data: { title: 'Admin Updated Author1 Note' },
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { doc: { title: string } };
		expect(data.doc.title).toBe('Admin Updated Author1 Note');
	});

	// ============================================
	// Delete scoping (THE FIX — previously not enforced)
	// ============================================

	test('author1 cannot delete editors note (defaultWhere blocks)', async () => {
		const response = await author1Context.delete(`/api/user-notes/${editorNoteId}`);
		expect(response.status()).toBe(404);
	});

	test('editor can delete their own note', async () => {
		const response = await editorContext.delete(`/api/user-notes/${editorNoteId}`);
		expect(response.ok()).toBe(true);
	});

	test('admin can delete any users note (bypasses defaultWhere)', async () => {
		const response = await adminContext.delete(`/api/user-notes/${author1NoteId}`);
		expect(response.ok()).toBe(true);
	});
});
