import { test, expect, type APIRequestContext } from '@playwright/test';
import { TEST_CREDENTIALS, TEST_EDITOR_CREDENTIALS } from './fixtures/e2e-utils';

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

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:4001';

test.describe('API Key Management', () => {
	let adminContext: APIRequestContext;

	test.beforeAll(async ({ playwright }) => {
		adminContext = await playwright.request.newContext({
			baseURL: BASE_URL,
			extraHTTPHeaders: { Origin: BASE_URL },
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
		const response = await adminContext.post('/api/api-keys', {
			data: { name: 'Test Key', role: 'editor' },
		});

		expect(response.status()).toBe(201);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
		const response = await adminContext.post('/api/api-keys', {
			data: {},
		});

		expect(response.status()).toBe(400);
	});

	test('create API key rejects invalid role', async () => {
		const response = await adminContext.post('/api/api-keys', {
			data: { name: 'Bad Role Key', role: 'superadmin' },
		});

		expect(response.status()).toBe(400);
	});

	test('list API keys returns created keys', async () => {
		await adminContext.post('/api/api-keys', {
			data: { name: 'List Test Key', role: 'viewer' },
		});

		const response = await adminContext.get('/api/api-keys');
		expect(response.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
		const createResponse = await adminContext.post('/api/api-keys', {
			data: { name: 'To Delete', role: 'user' },
		});
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const created = (await createResponse.json()) as { id: string };

		const deleteResponse = await adminContext.delete(`/api/api-keys/${created.id}`);
		expect(deleteResponse.ok()).toBe(true);

		const listResponse = await adminContext.get('/api/api-keys');
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const listData = (await listResponse.json()) as {
			keys: Array<{ id: string; name: string }>;
		};
		expect(listData.keys.find((k) => k.id === created.id)).toBeUndefined();
	});

	test('delete non-existent key returns 404', async () => {
		const response = await adminContext.delete('/api/api-keys/nonexistent-id');
		expect(response.status()).toBe(404);
	});
});

test.describe('API Key Authentication', () => {
	let adminContext: APIRequestContext;
	let apiKey: string;

	test.beforeAll(async ({ playwright }) => {
		adminContext = await playwright.request.newContext({
			baseURL: BASE_URL,
			extraHTTPHeaders: { Origin: BASE_URL },
		});

		const signInResponse = await adminContext.post('/api/auth/sign-in/email', {
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok()).toBe(true);

		const createResponse = await adminContext.post('/api/api-keys', {
			data: { name: 'Auth Test Key', role: 'admin' },
		});
		expect(createResponse.status()).toBe(201);
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const data = (await createResponse.json()) as { key: string };
		apiKey = data.key;
	});

	test.afterAll(async () => {
		await adminContext?.dispose();
	});

	test('API key authenticates requests to collection endpoints', async ({ playwright }) => {
		const keyContext = await playwright.request.newContext({
			baseURL: BASE_URL,
			extraHTTPHeaders: { 'X-API-Key': apiKey },
		});

		try {
			const response = await keyContext.get('/api/articles');
			expect(response.ok()).toBe(true);

			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
			const data = (await response.json()) as { docs: unknown[] };
			expect(Array.isArray(data.docs)).toBe(true);
		} finally {
			await keyContext.dispose();
		}
	});

	test('invalid API key is rejected', async ({ playwright }) => {
		const keyContext = await playwright.request.newContext({
			baseURL: BASE_URL,
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

	test('malformed API key is rejected', async ({ playwright }) => {
		const keyContext = await playwright.request.newContext({
			baseURL: BASE_URL,
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
	}) => {
		const anonContext = await playwright.request.newContext({ baseURL: BASE_URL });

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
	test('non-admin user cannot create API keys', async ({ playwright }) => {
		const editorContext = await playwright.request.newContext({
			baseURL: BASE_URL,
			extraHTTPHeaders: { Origin: BASE_URL },
		});

		try {
			const signInResponse = await editorContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_EDITOR_CREDENTIALS.email,
					password: TEST_EDITOR_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok()).toBe(true);

			const response = await editorContext.post('/api/api-keys', {
				data: { name: 'Editor Key', role: 'editor' },
			});
			expect(response.status()).toBe(403);
		} finally {
			await editorContext.dispose();
		}
	});

	test('non-admin user cannot list API keys', async ({ playwright }) => {
		const editorContext = await playwright.request.newContext({
			baseURL: BASE_URL,
			extraHTTPHeaders: { Origin: BASE_URL },
		});

		try {
			const signInResponse = await editorContext.post('/api/auth/sign-in/email', {
				data: {
					email: TEST_EDITOR_CREDENTIALS.email,
					password: TEST_EDITOR_CREDENTIALS.password,
				},
			});
			expect(signInResponse.ok()).toBe(true);

			const response = await editorContext.get('/api/api-keys');
			expect(response.status()).toBe(403);
		} finally {
			await editorContext.dispose();
		}
	});

	test('unauthenticated user cannot manage API keys', async ({ playwright }) => {
		const anonContext = await playwright.request.newContext({ baseURL: BASE_URL });

		try {
			const listResponse = await anonContext.get('/api/api-keys');
			expect(listResponse.status()).toBe(401);

			const createResponse = await anonContext.post('/api/api-keys', {
				data: { name: 'Anon Key' },
			});
			expect(createResponse.status()).toBe(401);
		} finally {
			await anonContext.dispose();
		}
	});
});
