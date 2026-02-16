import type { TestUserCredentials } from '@momentumcms/e2e-fixtures';

/**
 * Shared test user credentials used by both example apps and E2E tests.
 */
export const TEST_ADMIN: TestUserCredentials = {
	name: 'Test Admin',
	email: 'admin@test.com',
	password: 'TestPassword123!',
	role: 'admin',
};

export const TEST_EDITOR: TestUserCredentials = {
	name: 'Test Editor',
	email: 'editor@test.com',
	password: 'EditorPass123!',
	role: 'editor',
};

export const TEST_VIEWER: TestUserCredentials = {
	name: 'Test Viewer',
	email: 'viewer@test.com',
	password: 'ViewerPass123!',
	role: 'viewer',
};

export const TEST_AUTHOR_1: TestUserCredentials = {
	name: 'Test Author 1',
	email: 'author1@test.com',
	password: 'Author1Pass123!',
	role: 'editor',
};

export const TEST_AUTHOR_2: TestUserCredentials = {
	name: 'Test Author 2',
	email: 'author2@test.com',
	password: 'Author2Pass123!',
	role: 'editor',
};

export const TEST_AUTHOR_3: TestUserCredentials = {
	name: 'Test Author 3',
	email: 'author3@test.com',
	password: 'Author3Pass123!',
	role: 'editor',
};

/** All non-admin test users (editor, viewer, authors). */
export const ADDITIONAL_TEST_USERS: TestUserCredentials[] = [
	TEST_EDITOR,
	TEST_VIEWER,
	TEST_AUTHOR_1,
	TEST_AUTHOR_2,
	TEST_AUTHOR_3,
];

/** Author users only (subset of ADDITIONAL_TEST_USERS). */
export const AUTHOR_USERS: TestUserCredentials[] = [TEST_AUTHOR_1, TEST_AUTHOR_2, TEST_AUTHOR_3];
