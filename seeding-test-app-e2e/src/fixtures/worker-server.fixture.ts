import { createWorkerFixture, type TestUserCredentials } from '@momentum-cms/e2e-fixtures';
import * as path from 'node:path';

/**
 * Test user credentials for the seeding test app.
 */
export const TEST_CREDENTIALS: TestUserCredentials = {
	name: 'Test Admin',
	email: 'admin@test.com',
	password: 'TestPassword123!',
	role: 'admin',
};

export const TEST_EDITOR_CREDENTIALS: TestUserCredentials = {
	name: 'Test Editor',
	email: 'editor@test.com',
	password: 'EditorPass123!',
	role: 'editor',
};

export const TEST_VIEWER_CREDENTIALS: TestUserCredentials = {
	name: 'Test Viewer',
	email: 'viewer@test.com',
	password: 'ViewerPass123!',
	role: 'viewer',
};

export const TEST_AUTHOR1_CREDENTIALS: TestUserCredentials = {
	name: 'Author One',
	email: 'author1@test.com',
	password: 'Author1Pass123!',
	role: 'editor',
};

export const TEST_AUTHOR2_CREDENTIALS: TestUserCredentials = {
	name: 'Author Two',
	email: 'author2@test.com',
	password: 'Author2Pass123!',
	role: 'editor',
};

export const TEST_AUTHOR3_CREDENTIALS: TestUserCredentials = {
	name: 'Author Three',
	email: 'author3@test.com',
	password: 'Author3Pass123!',
	role: 'editor',
};

/** All non-admin test users. */
export const ADDITIONAL_TEST_USERS: TestUserCredentials[] = [
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
	TEST_AUTHOR1_CREDENTIALS,
	TEST_AUTHOR2_CREDENTIALS,
	TEST_AUTHOR3_CREDENTIALS,
];

const PROJECT_DIR = path.resolve(__dirname, '..', '..');
const WORKSPACE_ROOT = path.resolve(PROJECT_DIR, '..');

/**
 * Worker-scoped fixture for the seeding test app.
 * Each worker gets its own database, server, and set of test users.
 */
export const workerTest = createWorkerFixture({
	appName: 'seeding',
	serverBinary: 'dist/seeding-test-app/server/server.mjs',
	healthEndpoint: '/api/health?checkSeeds=true',
	waitForSeeds: true,
	adminUser: TEST_CREDENTIALS,
	additionalUsers: ADDITIONAL_TEST_USERS,
	smtpEnv: true,
	projectDir: PROJECT_DIR,
	workspaceRoot: WORKSPACE_ROOT,
});
