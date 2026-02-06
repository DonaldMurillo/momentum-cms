import { createWorkerFixture, type TestUserCredentials } from '@momentum-cms/e2e-fixtures';
import * as path from 'node:path';

/**
 * Test user credentials for the example-angular app.
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

/** All non-admin test users. */
export const ADDITIONAL_TEST_USERS: TestUserCredentials[] = [
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
];

const PROJECT_DIR = path.resolve(__dirname, '..', '..');
const WORKSPACE_ROOT = path.resolve(PROJECT_DIR, '..', '..');

/**
 * Worker-scoped fixture for the example-angular app.
 * Each worker gets its own database, server, and set of test users.
 */
export const workerTest = createWorkerFixture({
	appName: 'angular',
	serverBinary: 'dist/apps/example-angular/server/server.mjs',
	healthEndpoint: '/api/posts',
	waitForSeeds: false,
	adminUser: TEST_CREDENTIALS,
	additionalUsers: ADDITIONAL_TEST_USERS,
	smtpEnv: true,
	projectDir: PROJECT_DIR,
	workspaceRoot: WORKSPACE_ROOT,
});
