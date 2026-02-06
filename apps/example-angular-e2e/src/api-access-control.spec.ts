import {
	test,
	expect,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
} from './fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * API Access Control E2E Tests
 *
 * Comprehensive tests for access control via direct API calls.
 * Uses different test users (admin, editor, viewer) to verify role-based permissions.
 *
 * IMPORTANT: Tests run in SERIAL to avoid race conditions with user creation.
 *
 * Test Users:
 * - admin - Full access, created by worker fixture
 * - editor - Can create/update posts, no user access
 * - viewer - Read-only access
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

// IDs of posts created during tests (for cleanup/verification)
const createdPostIds: string[] = [];

/**
 * Helper to extract cookies from response headers.
 */
function extractCookies(response: { headers: () => Record<string, string> }): string[] | null {
	const headers = response.headers();
	const setCookies = headers['set-cookie'];
	if (!setCookies) {
		return null;
	}
	// Handle both single cookie and multiple cookies
	const cookieArray = Array.isArray(setCookies) ? setCookies : setCookies.split(', ');
	return cookieArray.filter((c) => c.includes('='));
}

/**
 * Helper to sign in and get session cookies.
 * Returns null if sign-in fails (user doesn't exist or wrong password).
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
 * Helper to sign up a new user via Better Auth.
 * Returns session cookies if successful, null on failure.
 */
async function trySignUp(
	request: APIRequestContext,
	name: string,
	email: string,
	password: string,
): Promise<string[] | null> {
	const response = await request.post(`/api/auth/sign-up/email`, {
		data: { name, email, password },
	});

	if (!response.ok()) {
		console.log(`[Test] Sign up failed for ${email}:`, await response.text());
		return null;
	}

	return extractCookies(response);
}

/**
 * Helper to sign in and get session cookies (throws on failure).
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
	const url = path;
	switch (method) {
		case 'GET':
			response = await request.get(url, options);
			break;
		case 'POST':
			response = await request.post(url, options);
			break;
		case 'PATCH':
			response = await request.patch(url, options);
			break;
		case 'DELETE':
			response = await request.delete(url, options);
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

/**
 * Ensure a Momentum user record exists with the correct role.
 * Creates the user if it doesn't exist. This handles the case where
 * Better Auth user exists but Momentum user record was not created
 * (e.g., from a previous partial test run or database reset).
 */
async function ensureMomentumUserExists(
	request: APIRequestContext,
	adminCookies: string[],
	user: { email: string; name: string; role: string },
): Promise<void> {
	// Get all users and filter client-side (where clause has issues)
	const { status, body } = await authenticatedRequest(request, adminCookies, 'GET', '/api/users');

	if (status === 200 && body && typeof body === 'object' && 'docs' in body) {
		const docs = (body as { docs: Array<{ email: string; role: string }> }).docs;
		const existingUser = docs.find((d) => d.email === user.email);

		if (existingUser) {
			console.log(
				`[Test] Momentum user ${user.email} already exists with role: ${existingUser.role}`,
			);
			// Verify the role matches
			if (existingUser.role !== user.role) {
				console.log(
					`[Test] Role mismatch: expected ${user.role}, got ${existingUser.role}. Continuing with existing role.`,
				);
			}
			return;
		}
	}

	// Create Momentum user record (without password - Better Auth user already exists)

	console.log(`[Test] Creating Momentum user record for ${user.email} with role ${user.role}`);
	const createResponse = await authenticatedRequest(request, adminCookies, 'POST', '/api/users', {
		name: user.name,
		email: user.email,
		role: user.role,
		active: true,
	});

	if (createResponse.status !== 201) {
		console.log(`[Test] Momentum user create failed:`, createResponse.status, createResponse.body);
	} else {
		console.log(`[Test] Momentum user ${user.email} created successfully`);
	}
}

// ============================================
// Test Setup - Create Test Users
// ============================================

test.describe('API Access Control - Setup', () => {
	test('sign in as admin (exists from global setup)', async ({ request }) => {
		sessions.admin = await signIn(request, TEST_USERS.admin.email, TEST_USERS.admin.password);
		expect(sessions.admin.length).toBeGreaterThan(0);
	});

	test('ensure editor user exists and sign in', async ({ request }) => {
		// Try to sign in first - user might exist from previous test run
		const existingSession = await trySignIn(
			request,
			TEST_USERS.editor.email,
			TEST_USERS.editor.password,
		);

		if (existingSession && existingSession.length > 0) {
			// User exists and password matches - use existing session

			console.log('[Test] Editor user exists, signed in successfully');
			sessions.editor = existingSession;

			// Ensure Momentum user record exists with correct role
			// (Better Auth user might exist without Momentum record from previous partial run)
			await ensureMomentumUserExists(request, sessions.admin, TEST_USERS.editor);
		} else {
			// User doesn't exist or password doesn't match - create via Better Auth

			console.log('[Test] Creating editor user via Better Auth...');
			const signUpSession = await trySignUp(
				request,
				TEST_USERS.editor.name,
				TEST_USERS.editor.email,
				TEST_USERS.editor.password,
			);

			if (signUpSession && signUpSession.length > 0) {
				console.log('[Test] Editor user created via Better Auth');

				// Create corresponding Momentum user record (without password)
				const momentumResponse = await authenticatedRequest(
					request,
					sessions.admin,
					'POST',
					'/api/users',
					{
						name: TEST_USERS.editor.name,
						email: TEST_USERS.editor.email,
						role: TEST_USERS.editor.role,
						active: true,
					},
				);

				if (momentumResponse.status !== 201) {
					console.log('[Test] Momentum user create response:', momentumResponse.status);
				}

				sessions.editor = signUpSession;
			} else {
				console.warn('[Test] Could not create editor user. Role-based tests may be skipped.');
				test.skip();
			}
		}

		expect(sessions.editor?.length ?? 0).toBeGreaterThan(0);
	});

	test('ensure viewer user exists and sign in', async ({ request }) => {
		// Try to sign in first - user might exist from previous test run
		const existingSession = await trySignIn(
			request,
			TEST_USERS.viewer.email,
			TEST_USERS.viewer.password,
		);

		if (existingSession && existingSession.length > 0) {
			console.log('[Test] Viewer user exists, signed in successfully');
			sessions.viewer = existingSession;

			// Ensure Momentum user record exists with correct role
			// (Better Auth user might exist without Momentum record from previous partial run)
			await ensureMomentumUserExists(request, sessions.admin, TEST_USERS.viewer);
		} else {
			// User doesn't exist or password doesn't match - create via Better Auth

			console.log('[Test] Creating viewer user via Better Auth...');
			const signUpSession = await trySignUp(
				request,
				TEST_USERS.viewer.name,
				TEST_USERS.viewer.email,
				TEST_USERS.viewer.password,
			);

			if (signUpSession && signUpSession.length > 0) {
				console.log('[Test] Viewer user created via Better Auth');

				// Create corresponding Momentum user record (without password)
				const momentumResponse = await authenticatedRequest(
					request,
					sessions.admin,
					'POST',
					'/api/users',
					{
						name: TEST_USERS.viewer.name,
						email: TEST_USERS.viewer.email,
						role: TEST_USERS.viewer.role,
						active: true,
					},
				);

				if (momentumResponse.status !== 201) {
					console.log('[Test] Momentum user create response:', momentumResponse.status);
				}

				sessions.viewer = signUpSession;
			} else {
				console.warn('[Test] Could not create viewer user. Role-based tests may be skipped.');
				test.skip();
			}
		}

		expect(sessions.viewer?.length ?? 0).toBeGreaterThan(0);
	});
});

// ============================================
// Posts Collection - Role-Based Access
// ============================================

test.describe('API Access Control - Posts Collection', () => {
	test('unauthenticated: can read posts (public)', async ({ request }) => {
		const response = await request.get(`/api/posts`);
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.docs).toBeDefined();
	});

	test('unauthenticated: cannot create posts (403)', async ({ request }) => {
		const response = await request.post(`/api/posts`, {
			data: {
				title: 'Unauthorized Post',
				slug: `unauthorized-${Date.now()}`,
				status: 'draft',
			},
		});
		expect(response.status()).toBe(403);
	});

	test('viewer: can read posts', async ({ request }) => {
		test.skip(!sessions.viewer, 'Viewer session not available');
		const { status, body } = await authenticatedRequest(
			request,
			sessions.viewer,
			'GET',
			'/api/posts',
		);
		expect(status).toBe(200);
		expect((body as { docs: unknown[] }).docs).toBeDefined();
	});

	test('viewer: cannot create posts (403)', async ({ request }) => {
		test.skip(!sessions.viewer, 'Viewer session not available');
		const { status } = await authenticatedRequest(request, sessions.viewer, 'POST', '/api/posts', {
			title: 'Viewer Post Attempt',
			slug: `viewer-attempt-${Date.now()}`,
			status: 'draft',
		});
		expect(status).toBe(403);
	});

	test('editor: can create posts', async ({ request }) => {
		test.skip(!sessions.editor, 'Editor session not available');
		const slug = `editor-post-${Date.now()}`;
		const { status, body } = await authenticatedRequest(
			request,
			sessions.editor,
			'POST',
			'/api/posts',
			{
				title: 'Editor Post',
				slug,
				content: 'Created by editor',
				status: 'draft',
			},
		);
		expect(status).toBe(201);
		const doc = (body as { doc: { id: string; title: string } }).doc;
		expect(doc.title).toBe('Editor Post');
		createdPostIds.push(doc.id);
	});

	test('editor: can update own posts', async ({ request }) => {
		test.skip(!sessions.editor, 'Editor session not available');
		// Create a post first
		const createSlug = `editor-update-test-${Date.now()}`;
		const createResult = await authenticatedRequest(
			request,
			sessions.editor,
			'POST',
			'/api/posts',
			{
				title: 'Post to Update',
				slug: createSlug,
				status: 'draft',
			},
		);
		expect(createResult.status).toBe(201);
		const postId = (createResult.body as { doc: { id: string } }).doc.id;
		createdPostIds.push(postId);

		// Update the post
		const { status, body } = await authenticatedRequest(
			request,
			sessions.editor,
			'PATCH',
			`/api/posts/${postId}`,
			{
				title: 'Updated Post Title',
			},
		);
		expect(status).toBe(200);
		expect((body as { doc: { title: string } }).doc.title).toBe('Updated Post Title');
	});

	test('editor: cannot delete posts (admin only, 403)', async ({ request }) => {
		test.skip(!sessions.editor, 'Editor session not available');
		// Create a post to attempt deletion
		const createSlug = `editor-delete-test-${Date.now()}`;
		const createResult = await authenticatedRequest(
			request,
			sessions.editor,
			'POST',
			'/api/posts',
			{
				title: 'Post Editor Cannot Delete',
				slug: createSlug,
				status: 'draft',
			},
		);
		expect(createResult.status).toBe(201);
		const postId = (createResult.body as { doc: { id: string } }).doc.id;
		createdPostIds.push(postId);

		// Attempt to delete
		const { status } = await authenticatedRequest(
			request,
			sessions.editor,
			'DELETE',
			`/api/posts/${postId}`,
		);
		expect(status).toBe(403);
	});

	test('admin: can create posts', async ({ request }) => {
		test.skip(!sessions.admin, 'Admin session not available');
		const slug = `admin-post-${Date.now()}`;
		const { status, body } = await authenticatedRequest(
			request,
			sessions.admin,
			'POST',
			'/api/posts',
			{
				title: 'Admin Post',
				slug,
				content: 'Created by admin',
				status: 'published',
			},
		);
		expect(status).toBe(201);
		createdPostIds.push((body as { doc: { id: string } }).doc.id);
	});

	test('admin: can delete posts', async ({ request }) => {
		test.skip(!sessions.admin, 'Admin session not available');
		// Create a post to delete
		const createSlug = `admin-delete-test-${Date.now()}`;
		const createResult = await authenticatedRequest(request, sessions.admin, 'POST', '/api/posts', {
			title: 'Admin Delete Test',
			slug: createSlug,
			status: 'draft',
		});
		expect(createResult.status).toBe(201);
		const postId = (createResult.body as { doc: { id: string } }).doc.id;

		// Delete the post
		const { status, body } = await authenticatedRequest(
			request,
			sessions.admin,
			'DELETE',
			`/api/posts/${postId}`,
		);
		expect(status).toBe(200);
		expect((body as { deleted: boolean }).deleted).toBe(true);
	});
});

// ============================================
// Users Collection - Admin Only
// ============================================

test.describe('API Access Control - Users Collection', () => {
	test('unauthenticated: cannot read users (403)', async ({ request }) => {
		const response = await request.get(`/api/users`);
		expect(response.status()).toBe(403);
	});

	test('viewer: cannot read users (403)', async ({ request }) => {
		test.skip(!sessions.viewer, 'Viewer session not available');
		const { status } = await authenticatedRequest(request, sessions.viewer, 'GET', '/api/users');
		expect(status).toBe(403);
	});

	test('editor: cannot read users (403)', async ({ request }) => {
		test.skip(!sessions.editor, 'Editor session not available');
		const { status } = await authenticatedRequest(request, sessions.editor, 'GET', '/api/users');
		expect(status).toBe(403);
	});

	test('admin: can read users', async ({ request }) => {
		test.skip(!sessions.admin, 'Admin session not available');
		const { status, body } = await authenticatedRequest(
			request,
			sessions.admin,
			'GET',
			'/api/users',
		);
		expect(status).toBe(200);
		const docs = (body as { docs: { email: string }[] }).docs;
		expect(docs).toBeDefined();
		expect(docs.length).toBeGreaterThan(0);

		// Verify our test users exist
		const emails = docs.map((d) => d.email);
		expect(emails).toContain(TEST_USERS.admin.email);
	});

	test('admin: can update users', async ({ request }) => {
		test.skip(!sessions.admin, 'Admin session not available');
		// Get list of users to find editor's ID
		const listResult = await authenticatedRequest(request, sessions.admin, 'GET', '/api/users');
		expect(listResult.status).toBe(200);

		const users = (listResult.body as { docs: { id: string; email: string; name: string }[] }).docs;
		const editor = users.find((u) => u.email === TEST_USERS.editor.email);

		if (editor) {
			const originalName = editor.name;
			const { status, body } = await authenticatedRequest(
				request,
				sessions.admin,
				'PATCH',
				`/api/users/${editor.id}`,
				{
					name: 'Updated Editor Name',
				},
			);
			expect(status).toBe(200);
			expect((body as { doc: { name: string } }).doc.name).toBe('Updated Editor Name');

			// Restore original name
			await authenticatedRequest(request, sessions.admin, 'PATCH', `/api/users/${editor.id}`, {
				name: originalName,
			});
		}
	});

	test('viewer: cannot create users (403)', async ({ request }) => {
		test.skip(!sessions.viewer, 'Viewer session not available');
		const { status } = await authenticatedRequest(request, sessions.viewer, 'POST', '/api/users', {
			name: 'Unauthorized User',
			email: 'unauthorized@test.com',
			role: 'viewer',
		});
		expect(status).toBe(403);
	});

	test('editor: cannot create users (403)', async ({ request }) => {
		test.skip(!sessions.editor, 'Editor session not available');
		const { status } = await authenticatedRequest(request, sessions.editor, 'POST', '/api/users', {
			name: 'Unauthorized User',
			email: 'unauthorized@test.com',
			role: 'viewer',
		});
		expect(status).toBe(403);
	});
});

// ============================================
// /api/access Endpoint - Permission Checks
// ============================================

test.describe('API Access Control - /api/access Endpoint', () => {
	test('returns correct permissions for unauthenticated user', async ({ request }) => {
		const response = await request.get(`/api/access`);
		expect(response.status()).toBe(200);

		const data = await response.json();
		const collections = data.collections as {
			slug: string;
			canAccess: boolean;
			canCreate: boolean;
			canRead: boolean;
			canDelete: boolean;
		}[];

		const posts = collections.find((c) => c.slug === 'posts');
		const users = collections.find((c) => c.slug === 'users');

		// Unauthenticated: can read posts (public), cannot access admin
		expect(posts?.canRead).toBe(true);
		expect(posts?.canAccess).toBe(false);
		expect(posts?.canCreate).toBe(false);

		// Unauthenticated: cannot access users at all
		expect(users?.canAccess).toBe(false);
		expect(users?.canRead).toBe(false);
	});

	test('returns correct permissions for admin', async ({ request }) => {
		test.skip(!sessions.admin, 'Admin session not available');
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
		const posts = collections.find((c) => c.slug === 'posts');
		const users = collections.find((c) => c.slug === 'users');

		// Admin has full access to posts
		expect(posts?.canAccess).toBe(true);
		expect(posts?.canCreate).toBe(true);
		expect(posts?.canRead).toBe(true);
		expect(posts?.canUpdate).toBe(true);
		expect(posts?.canDelete).toBe(true);

		// Admin has full access to users
		expect(users?.canAccess).toBe(true);
		expect(users?.canCreate).toBe(true);
		expect(users?.canRead).toBe(true);
		expect(users?.canUpdate).toBe(true);
		expect(users?.canDelete).toBe(true);
	});

	test('returns correct permissions for editor', async ({ request }) => {
		test.skip(!sessions.editor, 'Editor session not available');
		const { status, body } = await authenticatedRequest(
			request,
			sessions.editor,
			'GET',
			'/api/access',
		);
		expect(status).toBe(200);

		const collections = (
			body as {
				collections: { slug: string; canAccess: boolean; canCreate: boolean; canDelete: boolean }[];
			}
		).collections;
		const posts = collections.find((c) => c.slug === 'posts');
		const users = collections.find((c) => c.slug === 'users');

		// Editor can access posts admin, create/update, but NOT delete
		expect(posts?.canAccess).toBe(true);
		expect(posts?.canCreate).toBe(true);
		expect(posts?.canDelete).toBe(false);

		// Editor cannot access users admin
		expect(users?.canAccess).toBe(false);
	});

	test('returns correct permissions for viewer', async ({ request }) => {
		test.skip(!sessions.viewer, 'Viewer session not available');
		const { status, body } = await authenticatedRequest(
			request,
			sessions.viewer,
			'GET',
			'/api/access',
		);
		expect(status).toBe(200);

		const collections = (
			body as {
				collections: { slug: string; canAccess: boolean; canCreate: boolean; canDelete: boolean }[];
			}
		).collections;
		const posts = collections.find((c) => c.slug === 'posts');
		const users = collections.find((c) => c.slug === 'users');

		// Viewer can access posts admin (authenticated) but cannot create/delete
		expect(posts?.canAccess).toBe(true);
		expect(posts?.canCreate).toBe(false);
		expect(posts?.canDelete).toBe(false);

		// Viewer cannot access users
		expect(users?.canAccess).toBe(false);
	});
});

// ============================================
// Error Response Format
// ============================================

test.describe('API Access Control - Error Responses', () => {
	test('403 response includes error message', async ({ request }) => {
		const response = await request.post(`/api/posts`, {
			data: { title: 'Test', slug: 'test' },
		});
		expect(response.status()).toBe(403);

		const body = await response.json();
		expect(body.error).toBeDefined();
		expect(body.error).toContain('denied');
	});

	test('404 for non-existent collection, not 403', async ({ request }) => {
		const response = await request.get(`/api/nonexistent`);
		expect(response.status()).toBe(404);
	});
});
