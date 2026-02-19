import {
	test,
	expect,
	TEST_CREDENTIALS,
	ADDITIONAL_TEST_USERS,
	type TestUserCredentials,
} from '../fixtures';

/**
 * Multi-user setup verification tests.
 * Verifies all test users were created and can authenticate via API.
 */
test.describe('Multi-user setup', { tag: ['@auth', '@api'] }, () => {
	const allUsers: TestUserCredentials[] = [TEST_CREDENTIALS, ...ADDITIONAL_TEST_USERS];

	for (const user of allUsers) {
		test(`user ${user.email} (${user.role}) can sign in via API`, async ({ request }) => {
			const response = await request.post('/api/auth/sign-in/email', {
				headers: { 'Content-Type': 'application/json' },
				data: {
					email: user.email,
					password: user.password,
				},
			});

			expect(response.ok(), `Sign-in should succeed for ${user.email}`).toBe(true);

			// Verify response contains user data

			const body = (await response.json()) as {
				user?: { email?: string };
				token?: string;
			};
			expect(body.user, `Response should contain user object for ${user.email}`).toBeTruthy();
		});
	}

	test('admin can list all users with correct roles', async ({ request }) => {
		// Sign in as admin
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in should succeed').toBe(true);

		// Fetch auth-user collection (managed by auth plugin, read-only)
		const response = await request.get('/api/auth-user?limit=100');
		expect(response.ok(), 'Auth-user list should be accessible').toBe(true);

		const data = (await response.json()) as {
			docs: Array<{ email: string; role?: string }>;
		};

		// Verify all users exist with correct roles
		for (const user of allUsers) {
			const found = data.docs.find((doc) => doc.email === user.email);
			expect(found, `User ${user.email} should exist in auth-user collection`).toBeTruthy();
			expect(found?.role, `User ${user.email} should have role '${user.role}'`).toBe(user.role);
		}
	});
});
