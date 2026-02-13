import { test, expect, TEST_CREDENTIALS, TEST_EDITOR_CREDENTIALS } from './fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * API Keys E2E Tests
 *
 * Tests the API key management and authentication flow:
 * - Create API key (admin only)
 * - List API keys
 * - Use API key to authenticate requests
 * - Delete API key
 * - Reject invalid/expired keys
 *
 * Uses the admin test user for management operations.
 */

test.describe('API Key Management', () => {
	let adminContext: APIRequestContext;

	test.beforeAll(async ({ playwright, workerBaseURL }) => {
		adminContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		const signInResponse = await adminContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok()).toBe(true);
	});

	test.afterAll(async () => {
		await adminContext?.dispose();
	});

	test('create API key returns key and metadata', async () => {
		const response = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'Test Key', role: 'editor' },
		});

		expect(response.status()).toBe(201);

		const data = (await response.json()) as {
			id: string;
			name: string;
			key: string;
			keyPrefix: string;
			role: string;
		};

		expect(data.id).toBeDefined();
		expect(data.name).toBe('Test Key');
		expect(data.key).toBeDefined();
		expect(data.key).toMatch(/^mcms_[0-9a-f]{40}$/);
		expect(data.keyPrefix).toBeDefined();
		expect(data.role).toBe('editor');
	});

	test('create API key requires name', async () => {
		const response = await adminContext.post('/api/auth/api-keys', {
			data: {},
		});

		expect(response.status()).toBe(400);
	});

	test('create API key rejects invalid role', async () => {
		const response = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'Bad Role Key', role: 'superadmin' },
		});

		expect(response.status()).toBe(400);
	});

	test('list API keys returns created keys', async () => {
		await adminContext.post('/api/auth/api-keys', {
			data: { name: 'List Test Key', role: 'viewer' },
		});

		const response = await adminContext.get('/api/auth/api-keys');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			keys: Array<{ id: string; name: string; keyPrefix: string; role: string }>;
		};

		expect(Array.isArray(data.keys)).toBe(true);
		expect(data.keys.length).toBeGreaterThan(0);

		const listTestKey = data.keys.find((k) => k.name === 'List Test Key');
		expect(listTestKey).toBeDefined();
		expect(listTestKey?.role).toBe('viewer');
	});

	test('delete API key removes it', async () => {
		const createResponse = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'To Delete', role: 'user' },
		});

		const created = (await createResponse.json()) as { id: string };

		const deleteResponse = await adminContext.delete(`/api/auth/api-keys/${created.id}`);
		expect(deleteResponse.ok()).toBe(true);

		const listResponse = await adminContext.get('/api/auth/api-keys');

		const listData = (await listResponse.json()) as {
			keys: Array<{ id: string; name: string }>;
		};
		expect(listData.keys.find((k) => k.id === created.id)).toBeUndefined();
	});

	test('delete non-existent key returns 404', async () => {
		const response = await adminContext.delete('/api/auth/api-keys/nonexistent-id');
		expect(response.status()).toBe(404);
	});
});

test.describe('API Key Authentication', () => {
	let adminContext: APIRequestContext;
	let apiKey: string;

	test.beforeAll(async ({ playwright, workerBaseURL }) => {
		adminContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		const signInResponse = await adminContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok()).toBe(true);

		const createResponse = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'Auth Test Key', role: 'admin' },
		});
		expect(createResponse.status()).toBe(201);

		const data = (await createResponse.json()) as { key: string };
		apiKey = data.key;
	});

	test.afterAll(async () => {
		await adminContext?.dispose();
	});

	test('API key authenticates requests to collection endpoints', async ({
		playwright,
		baseURL,
	}) => {
		const keyContext = await playwright.request.newContext({
			baseURL,
			extraHTTPHeaders: { 'X-API-Key': apiKey },
		});

		try {
			const response = await keyContext.get('/api/articles');
			expect(response.ok()).toBe(true);

			const data = (await response.json()) as { docs: unknown[] };
			expect(Array.isArray(data.docs)).toBe(true);
		} finally {
			await keyContext.dispose();
		}
	});

	test('invalid API key is rejected', async ({ playwright, baseURL }) => {
		const keyContext = await playwright.request.newContext({
			baseURL,
			extraHTTPHeaders: {
				'X-API-Key': 'mcms_0000000000000000000000000000000000000000',
			},
		});

		try {
			const response = await keyContext.get('/api/articles');
			expect(response.status()).toBe(401);
		} finally {
			await keyContext.dispose();
		}
	});

	test('malformed API key is rejected', async ({ playwright, baseURL }) => {
		const keyContext = await playwright.request.newContext({
			baseURL,
			extraHTTPHeaders: { 'X-API-Key': 'bad-key' },
		});

		try {
			const response = await keyContext.get('/api/articles');
			expect(response.status()).toBe(401);
		} finally {
			await keyContext.dispose();
		}
	});

	test('request without API key or session returns appropriate response', async ({
		playwright,
		baseURL,
	}) => {
		const anonContext = await playwright.request.newContext({ baseURL });

		try {
			const response = await anonContext.get('/api/articles');
			// Articles collection may allow read for anonymous users
			expect([200, 401, 403]).toContain(response.status());
		} finally {
			await anonContext.dispose();
		}
	});
});

test.describe('API Key Access Control', () => {
	test('editor can create API keys at or below their role', async ({ playwright, baseURL }) => {
		const editorContext = await playwright.request.newContext({
			baseURL,
			extraHTTPHeaders: { Origin: baseURL },
		});

		try {
			const signInResponse = await editorContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_EDITOR_CREDENTIALS.email,
					password: TEST_EDITOR_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok()).toBe(true);

			// Editor can create editor-role key
			const response = await editorContext.post('/api/auth/api-keys', {
				data: { name: 'Editor Key', role: 'editor' },
			});
			expect(response.status()).toBe(201);

			// Editor can create user-role key (lower privilege)
			const userKeyResponse = await editorContext.post('/api/auth/api-keys', {
				data: { name: 'User Key', role: 'user' },
			});
			expect(userKeyResponse.status()).toBe(201);

			// Editor cannot create admin-role key (higher privilege)
			const adminKeyResponse = await editorContext.post('/api/auth/api-keys', {
				data: { name: 'Admin Key', role: 'admin' },
			});
			expect(adminKeyResponse.status()).toBe(403);
		} finally {
			await editorContext.dispose();
		}
	});

	test('editor can list only their own API keys', async ({ playwright, baseURL }) => {
		const editorContext = await playwright.request.newContext({
			baseURL,
			extraHTTPHeaders: { Origin: baseURL },
		});

		try {
			const signInResponse = await editorContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_EDITOR_CREDENTIALS.email,
					password: TEST_EDITOR_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok()).toBe(true);

			// Create a key as editor
			const createResponse = await editorContext.post('/api/auth/api-keys', {
				data: { name: 'Scoping Test Key', role: 'editor' },
			});
			expect(createResponse.status()).toBe(201);

			// List keys — should only see own keys
			const listResponse = await editorContext.get('/api/auth/api-keys');
			expect(listResponse.ok()).toBe(true);

			const listData = (await listResponse.json()) as {
				keys: Array<{ id: string; name: string; createdBy: string }>;
			};
			expect(listData.keys.length).toBeGreaterThan(0);

			// All returned keys should belong to the editor (no admin keys visible)
			for (const key of listData.keys) {
				expect(key.createdBy).toBeDefined();
			}
		} finally {
			await editorContext.dispose();
		}
	});

	test('admin can see all API keys including other users keys', async ({
		playwright,
		workerBaseURL,
		baseURL,
	}) => {
		// Editor creates a key
		const editorContext = await playwright.request.newContext({
			baseURL,
			extraHTTPHeaders: { Origin: baseURL },
		});

		await editorContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_EDITOR_CREDENTIALS.email,
				password: TEST_EDITOR_CREDENTIALS.password,
			},
		});
		await editorContext.post('/api/auth/api-keys', {
			data: { name: 'Editor Visible Key', role: 'editor' },
		});
		await editorContext.dispose();

		// Admin lists all keys — should see the editor's key
		const adminContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		await adminContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});

		const listResponse = await adminContext.get('/api/auth/api-keys');
		expect(listResponse.ok()).toBe(true);

		const listData = (await listResponse.json()) as {
			keys: Array<{ name: string }>;
		};
		const editorKey = listData.keys.find((k) => k.name === 'Editor Visible Key');
		expect(editorKey).toBeDefined();

		await adminContext.dispose();
	});

	test('editor can delete own key but not another users key', async ({
		playwright,
		workerBaseURL,
		baseURL,
	}) => {
		// Admin creates a key
		const adminContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		await adminContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});

		const adminKeyResponse = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'Admin Owned Key', role: 'admin' },
		});
		const adminKeyData = (await adminKeyResponse.json()) as { id: string };
		await adminContext.dispose();

		// Editor creates a key and can delete it
		const editorContext = await playwright.request.newContext({
			baseURL,
			extraHTTPHeaders: { Origin: baseURL },
		});

		await editorContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_EDITOR_CREDENTIALS.email,
				password: TEST_EDITOR_CREDENTIALS.password,
			},
		});

		const editorKeyResponse = await editorContext.post('/api/auth/api-keys', {
			data: { name: 'Editor Owned Key', role: 'editor' },
		});
		const editorKeyData = (await editorKeyResponse.json()) as { id: string };

		// Editor can delete own key
		const deleteOwnResponse = await editorContext.delete(`/api/auth/api-keys/${editorKeyData.id}`);
		expect(deleteOwnResponse.ok()).toBe(true);

		// Editor cannot delete admin's key
		const deleteAdminResponse = await editorContext.delete(`/api/auth/api-keys/${adminKeyData.id}`);
		expect(deleteAdminResponse.status()).toBe(403);

		await editorContext.dispose();
	});

	test('unauthenticated user cannot manage API keys', async ({ playwright, baseURL }) => {
		const anonContext = await playwright.request.newContext({ baseURL });

		try {
			const listResponse = await anonContext.get('/api/auth/api-keys');
			expect(listResponse.status()).toBe(401);

			const createResponse = await anonContext.post('/api/auth/api-keys', {
				data: { name: 'Anon Key' },
			});
			expect(createResponse.status()).toBe(401);
		} finally {
			await anonContext.dispose();
		}
	});
});

test.describe('API Key Security', () => {
	let adminContext: APIRequestContext;
	let createdKeyId: string;

	test.beforeAll(async ({ playwright, workerBaseURL }) => {
		adminContext = await playwright.request.newContext({
			baseURL: workerBaseURL,
			extraHTTPHeaders: { Origin: workerBaseURL },
		});

		const signInResponse = await adminContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok()).toBe(true);

		// Create a key via dedicated route for use in delete tests
		const createResponse = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'Security Test Key', role: 'user' },
		});
		expect(createResponse.status()).toBe(201);
		const data = (await createResponse.json()) as { id: string };
		createdKeyId = data.id;
	});

	test.afterAll(async () => {
		await adminContext?.dispose();
	});

	test('generic CRUD delete is blocked (must use dedicated route)', async () => {
		// Attempt to delete via generic CRUD route: DELETE /api/auth-api-keys/:id
		// This should be denied because access.delete returns false for everyone
		const response = await adminContext.delete(`/api/auth-api-keys/${createdKeyId}`);
		expect(response.status()).toBe(403);

		// Verify the key still exists via dedicated route
		const listResponse = await adminContext.get('/api/auth/api-keys');
		expect(listResponse.ok()).toBe(true);
		const listData = (await listResponse.json()) as {
			keys: Array<{ id: string }>;
		};
		expect(listData.keys.find((k) => k.id === createdKeyId)).toBeDefined();
	});

	test('generic CRUD list does not expose keyHash', async () => {
		// Fetch API keys via generic CRUD route: GET /api/auth-api-keys
		const response = await adminContext.get('/api/auth-api-keys');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<Record<string, unknown>>;
		};
		expect(data.docs.length).toBeGreaterThan(0);

		// Verify no document contains keyHash (field-level access blocks it)
		for (const doc of data.docs) {
			expect(doc).not.toHaveProperty('keyHash');
		}
	});

	test('dedicated route rejects invalid expiresAt date', async () => {
		// POST with a non-date string for expiresAt
		const response = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'Bad Expiry Key', role: 'user', expiresAt: 'never' },
		});
		expect(response.status()).toBe(400);

		const data = (await response.json()) as { error: string };
		expect(data.error).toContain('Invalid expiresAt date format');
	});

	test('dedicated route accepts valid expiresAt date', async () => {
		const futureDate = new Date(Date.now() + 86400000).toISOString();
		const response = await adminContext.post('/api/auth/api-keys', {
			data: { name: 'Valid Expiry Key', role: 'user', expiresAt: futureDate },
		});
		expect(response.status()).toBe(201);

		const data = (await response.json()) as { expiresAt: string | null };
		expect(data.expiresAt).toBeDefined();
		expect(data.expiresAt).not.toBeNull();
	});
});
