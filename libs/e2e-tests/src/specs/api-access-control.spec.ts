import {
	test,
	expect,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
} from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * API Access Control E2E Tests
 *
 * Comprehensive tests for access control via direct API calls.
 * Uses different test users (admin, editor, viewer) to verify role-based permissions.
 *
 * IMPORTANT: Tests run in SERIAL to avoid race conditions with user creation.
 *
 * Collections used:
 * - Categories: allowAll (public access for all operations)
 * - User Notes: requires authentication for all operations
 * - Auth Users: admin-only for all operations
 */

// Configure ALL tests in this file to run in serial
test.describe.configure({ mode: 'serial' });

// Test user credentials (from worker fixture)
const TEST_USERS = {
	admin: TEST_CREDENTIALS,
	editor: TEST_EDITOR_CREDENTIALS,
	viewer: TEST_VIEWER_CREDENTIALS,
};

// Session cookies for each user (persisted across tests in serial mode)
const sessions: Record<string, string[]> = {};

/**
 * Helper to extract cookies from response headers.
 */
function extractCookies(response: { headers: () => Record<string, string> }): string[] | null {
	const headers = response.headers();
	const setCookies = headers['set-cookie'];
	if (!setCookies) {
		return null;
	}
	const cookieArray = Array.isArray(setCookies) ? setCookies : setCookies.split(', ');
	return cookieArray.filter((c) => c.includes('='));
}

/**
 * Helper to sign in and get session cookies.
 */
async function trySignIn(
	request: APIRequestContext,
	email: string,
	password: string,
): Promise<string[] | null> {
	const response = await request.post(`/api/auth/sign-in/email`, {
		data: { email, password },
	});

	if (!response.ok()) {
		return null;
	}

	return extractCookies(response);
}

/**
 * Helper to sign in (throws on failure).
 */
async function signIn(
	request: APIRequestContext,
	email: string,
	password: string,
): Promise<string[]> {
	const cookies = await trySignIn(request, email, password);
	if (!cookies || cookies.length === 0) {
		throw new Error(`Sign in failed for ${email}`);
	}
	return cookies;
}

/**
 * Helper to make authenticated API request
 */
async function authenticatedRequest(
	request: APIRequestContext,
	cookies: string[],
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	path: string,
	data?: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
	const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');

	const options: { headers: { Cookie: string }; data?: Record<string, unknown> } = {
		headers: { Cookie: cookieHeader },
	};
	if (data) {
		options.data = data;
	}

	let response;
	switch (method) {
		case 'GET':
			response = await request.get(path, options);
			break;
		case 'POST':
			response = await request.post(path, options);
			break;
		case 'PATCH':
			response = await request.patch(path, options);
			break;
		case 'DELETE':
			response = await request.delete(path, options);
			break;
	}

	let body: unknown;
	const contentType = response.headers()['content-type'] ?? '';
	if (contentType.includes('application/json')) {
		body = await response.json();
	} else {
		body = await response.text();
	}

	return { status: response.status(), body };
}

// ============================================
// Test Setup - Sign In Users
// ============================================

test.describe('API Access Control - Setup', () => {
	test('sign in as admin', async ({ request }) => {
		sessions.admin = await signIn(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
		expect(sessions.admin.length).toBeGreaterThan(0);
	});

	test('sign in as editor', async ({ request }) => {
		sessions.editor = await signIn(request, TEST_USERS.editor.email, TEST_USERS.editor.password);
		expect(sessions.editor.length).toBeGreaterThan(0);
	});

	test('sign in as viewer', async ({ request }) => {
		sessions.viewer = await signIn(request, TEST_USERS.viewer.email, TEST_USERS.viewer.password);
		expect(sessions.viewer.length).toBeGreaterThan(0);
	});
});

// ============================================
// User Notes Collection - Auth Required
// ============================================

test.describe('API Access Control - User Notes (Auth Required)', () => {
	test('unauthenticated: cannot read user-notes (403)', async ({ request }) => {
		const response = await request.get('/api/user-notes');
		expect(response.status()).toBe(403);
	});

	test('unauthenticated: cannot create user-notes (403)', async ({ request }) => {
		const response = await request.post('/api/user-notes', {
			data: { title: 'Unauthorized' },
		});
		expect(response.status()).toBe(403);
	});

	test('viewer: can read user-notes (authenticated)', async ({ request }) => {
		expect(sessions.viewer, 'Viewer session must exist from setup').toBeTruthy();
		const { status, body } = await authenticatedRequest(
			request,
			sessions.viewer,
			'GET',
			'/api/user-notes',
		);
		expect(status).toBe(200);
		expect((body as { docs: unknown[] }).docs).toBeDefined();
	});

	test('editor: can create user-notes', async ({ request }) => {
		expect(sessions.editor, 'Editor session must exist from setup').toBeTruthy();
		const { status, body } = await authenticatedRequest(
			request,
			sessions.editor,
			'POST',
			'/api/user-notes',
			{
				title: `Editor Note ${Date.now()}`,
			},
		);
		expect(status).toBe(201);
		const doc = (body as { doc: { id: string; title: string } }).doc;
		expect(doc.title).toContain('Editor Note');
	});

	test('admin: can create and delete user-notes', async ({ request }) => {
		expect(sessions.admin, 'Admin session must exist from setup').toBeTruthy();

		// Create
		const createResult = await authenticatedRequest(
			request,
			sessions.admin,
			'POST',
			'/api/user-notes',
			{
				title: `Admin Note ${Date.now()}`,
			},
		);
		expect(createResult.status).toBe(201);
		const noteId = (createResult.body as { doc: { id: string } }).doc.id;

		// Delete
		const { status, body } = await authenticatedRequest(
			request,
			sessions.admin,
			'DELETE',
			`/api/user-notes/${noteId}`,
		);
		expect(status).toBe(200);
		expect((body as { deleted: boolean }).deleted).toBe(true);
	});
});

// ============================================
// Categories Collection - Public Access
// ============================================

test.describe('API Access Control - Categories (Public)', () => {
	test('unauthenticated: can read categories', async ({ request }) => {
		const response = await request.get('/api/categories');
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.docs).toBeDefined();
	});

	test('unauthenticated: can create categories (allowAll)', async ({ request }) => {
		const response = await request.post('/api/categories', {
			data: {
				name: `Public Category ${Date.now()}`,
				slug: `public-cat-${Date.now()}`,
			},
		});
		expect(response.status()).toBe(201);
	});
});

// ============================================
// Users Collection - Admin Only
// ============================================

test.describe('API Access Control - Users Collection', () => {
	test('unauthenticated: cannot read users (403)', async ({ request }) => {
		const response = await request.get('/api/auth-user');
		expect(response.status()).toBe(403);
	});

	test('viewer: cannot read users (403)', async ({ request }) => {
		expect(sessions.viewer, 'Viewer session must exist from setup').toBeTruthy();
		const { status } = await authenticatedRequest(
			request,
			sessions.viewer,
			'GET',
			'/api/auth-user',
		);
		expect(status).toBe(403);
	});

	test('editor: cannot read users (403)', async ({ request }) => {
		expect(sessions.editor, 'Editor session must exist from setup').toBeTruthy();
		const { status } = await authenticatedRequest(
			request,
			sessions.editor,
			'GET',
			'/api/auth-user',
		);
		expect(status).toBe(403);
	});

	test('admin: can read users', async ({ request }) => {
		expect(sessions.admin, 'Admin session must exist from setup').toBeTruthy();
		const { status, body } = await authenticatedRequest(
			request,
			sessions.admin,
			'GET',
			'/api/auth-user',
		);
		expect(status).toBe(200);
		const docs = (body as { docs: { email: string }[] }).docs;
		expect(docs).toBeDefined();
		expect(docs.length).toBeGreaterThan(0);

		// Verify our test users exist
		const emails = docs.map((d) => d.email);
		expect(emails).toContain(TEST_USERS.admin.email);
	});
});

// ============================================
// /api/access Endpoint - Permission Checks
// ============================================

test.describe('API Access Control - /api/access Endpoint', () => {
	test('returns correct permissions for unauthenticated user', async ({ request }) => {
		const response = await request.get('/api/access');
		expect(response.status()).toBe(200);

		const data = await response.json();
		const collections = data.collections as {
			slug: string;
			canAccess: boolean;
			canCreate: boolean;
			canRead: boolean;
			canDelete: boolean;
		}[];

		const categories = collections.find((c) => c.slug === 'categories');
		const userNotes = collections.find((c) => c.slug === 'user-notes');
		const users = collections.find((c) => c.slug === 'auth-user');

		// Unauthenticated: categories is public (allowAll)
		expect(categories?.canRead).toBe(true);
		expect(categories?.canCreate).toBe(true);

		// Unauthenticated: user-notes requires auth
		expect(userNotes?.canRead).toBe(false);
		expect(userNotes?.canCreate).toBe(false);

		// Unauthenticated: cannot access users at all
		expect(users?.canAccess).toBe(false);
		expect(users?.canRead).toBe(false);
	});

	test('returns correct permissions for admin', async ({ request }) => {
		expect(sessions.admin, 'Admin session must exist from setup').toBeTruthy();
		const { status, body } = await authenticatedRequest(
			request,
			sessions.admin,
			'GET',
			'/api/access',
		);
		expect(status).toBe(200);

		const collections = (
			body as {
				collections: {
					slug: string;
					canAccess: boolean;
					canCreate: boolean;
					canRead: boolean;
					canUpdate: boolean;
					canDelete: boolean;
				}[];
			}
		).collections;

		const userNotes = collections.find((c) => c.slug === 'user-notes');
		const users = collections.find((c) => c.slug === 'auth-user');

		// Admin has full access to user-notes
		expect(userNotes?.canAccess).toBe(true);
		expect(userNotes?.canCreate).toBe(true);
		expect(userNotes?.canRead).toBe(true);
		expect(userNotes?.canUpdate).toBe(true);
		expect(userNotes?.canDelete).toBe(true);

		// Admin has full access to auth-user
		expect(users?.canAccess).toBe(true);
		expect(users?.canCreate).toBe(true);
		expect(users?.canRead).toBe(true);
		expect(users?.canUpdate).toBe(true);
		expect(users?.canDelete).toBe(true);
	});
});

// ============================================
// Error Response Format
// ============================================

test.describe('API Access Control - Error Responses', () => {
	test('403 response includes error message', async ({ request }) => {
		const response = await request.post('/api/user-notes', {
			data: { title: 'Unauthorized' },
		});
		expect(response.status()).toBe(403);

		const body = await response.json();
		expect(body.error).toBeDefined();
		expect(body.error).toContain('denied');
	});

	test('404 for non-existent collection, not 403', async ({ request }) => {
		const response = await request.get('/api/nonexistent');
		expect(response.status()).toBe(404);
	});
});
