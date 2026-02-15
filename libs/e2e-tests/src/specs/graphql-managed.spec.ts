import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * GraphQL Managed Collection E2E Tests
 *
 * Verifies that managed collections (auth-session, auth-account, auth-verification)
 * do NOT have GraphQL mutations generated. Managed collections are owned by Better Auth
 * and must be read-only — the REST API enforces this with a 403, and GraphQL must
 * not generate create/update/delete mutations for them.
 *
 * Uses admin credentials because managed auth collections require admin access.
 */
test.describe('GraphQL managed collection mutations', () => {
	test.beforeAll(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test('managed collections should NOT have mutations in introspection schema', async ({
		request,
	}) => {
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `{
					__type(name: "Mutation") {
						fields { name }
					}
				}`,
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				__type: {
					fields: Array<{ name: string }>;
				} | null;
			};
		};

		const mutationNames = (data.data.__type?.fields ?? []).map((f) => f.name);

		// Managed collections must NOT have create/update/delete mutations
		// auth-session -> AuthSession
		expect(mutationNames).not.toContain('createAuthSession');
		expect(mutationNames).not.toContain('updateAuthSession');
		expect(mutationNames).not.toContain('deleteAuthSession');

		// auth-account -> AuthAccount
		expect(mutationNames).not.toContain('createAuthAccount');
		expect(mutationNames).not.toContain('updateAuthAccount');
		expect(mutationNames).not.toContain('deleteAuthAccount');

		// auth-verification -> AuthVerification
		expect(mutationNames).not.toContain('createAuthVerification');
		expect(mutationNames).not.toContain('updateAuthVerification');
		expect(mutationNames).not.toContain('deleteAuthVerification');

		// Non-managed collections SHOULD still have mutations
		expect(mutationNames).toContain('createCategory');
		expect(mutationNames).toContain('updateCategory');
		expect(mutationNames).toContain('deleteCategory');
	});

	test('managed collections should still have queries in introspection schema', async ({
		request,
	}) => {
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `{
					__type(name: "Query") {
						fields { name }
					}
				}`,
			},
		});
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			data: {
				__type: {
					fields: Array<{ name: string }>;
				} | null;
			};
		};

		const queryNames = (data.data.__type?.fields ?? []).map((f) => f.name);

		// Managed collections should still have read queries
		expect(queryNames).toContain('authSession');
		expect(queryNames).toContain('authAccount');
		expect(queryNames).toContain('authVerification');
	});

	test('attempting a mutation on a managed collection returns GraphQL error', async ({
		request,
	}) => {
		const response = await request.post('/api/graphql', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				query: `mutation {
					createAuthSession(data: { token: "fake" }) {
						id
					}
				}`,
			},
		});
		// GraphQL returns 200 even for errors
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			errors?: Array<{ message: string }>;
		};

		expect(data.errors).toBeDefined();
		expect(data.errors!.length).toBeGreaterThan(0);
	});
});
