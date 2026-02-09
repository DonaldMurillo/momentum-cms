import type { Page } from '@playwright/test';
import { createAuthPageFixture, getWorkerAuthFilePath } from '@momentum-cms/e2e-fixtures';
import {
	workerTest,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
	TEST_AUTHOR1_CREDENTIALS,
	TEST_AUTHOR2_CREDENTIALS,
	TEST_AUTHOR3_CREDENTIALS,
} from './worker-server.fixture';
import * as path from 'node:path';

const PROJECT_DIR = path.resolve(__dirname, '..', '..');

/**
 * Get the auth file path for a user in the current worker.
 * Used by auth fixtures to load/save per-worker auth state.
 */
function authFileForWorker(email: string, workerIndex: number): string {
	return getWorkerAuthFilePath(PROJECT_DIR, workerIndex, email);
}

// Track workerIndex for auth fixtures (set by workerBaseURL auto-fixture)
let currentWorkerIndex = 0;

/**
 * Extended test with worker server + per-role authenticated page fixtures.
 */
export const test = workerTest.extend<{
	authenticatedPage: Page;
	editorPage: Page;
	viewerPage: Page;
	author1Page: Page;
	author2Page: Page;
	author3Page: Page;
}>({
	// Capture workerIndex for auth file routing
	authenticatedPage: async ({ browser }, use, workerInfo) => {
		currentWorkerIndex = workerInfo.workerIndex;
		const fixture = createAuthPageFixture(TEST_CREDENTIALS, () =>
			authFileForWorker(TEST_CREDENTIALS.email, currentWorkerIndex),
		);
		await fixture({ browser }, use);
	},
	editorPage: async ({ browser }, use, workerInfo) => {
		currentWorkerIndex = workerInfo.workerIndex;
		const fixture = createAuthPageFixture(TEST_EDITOR_CREDENTIALS, () =>
			authFileForWorker(TEST_EDITOR_CREDENTIALS.email, currentWorkerIndex),
		);
		await fixture({ browser }, use);
	},
	viewerPage: async ({ browser }, use, workerInfo) => {
		currentWorkerIndex = workerInfo.workerIndex;
		const fixture = createAuthPageFixture(TEST_VIEWER_CREDENTIALS, () =>
			authFileForWorker(TEST_VIEWER_CREDENTIALS.email, currentWorkerIndex),
		);
		await fixture({ browser }, use);
	},
	author1Page: async ({ browser }, use, workerInfo) => {
		currentWorkerIndex = workerInfo.workerIndex;
		const fixture = createAuthPageFixture(TEST_AUTHOR1_CREDENTIALS, () =>
			authFileForWorker(TEST_AUTHOR1_CREDENTIALS.email, currentWorkerIndex),
		);
		await fixture({ browser }, use);
	},
	author2Page: async ({ browser }, use, workerInfo) => {
		currentWorkerIndex = workerInfo.workerIndex;
		const fixture = createAuthPageFixture(TEST_AUTHOR2_CREDENTIALS, () =>
			authFileForWorker(TEST_AUTHOR2_CREDENTIALS.email, currentWorkerIndex),
		);
		await fixture({ browser }, use);
	},
	author3Page: async ({ browser }, use, workerInfo) => {
		currentWorkerIndex = workerInfo.workerIndex;
		const fixture = createAuthPageFixture(TEST_AUTHOR3_CREDENTIALS, () =>
			authFileForWorker(TEST_AUTHOR3_CREDENTIALS.email, currentWorkerIndex),
		);
		await fixture({ browser }, use);
	},
});

export { expect } from '@playwright/test';

// Re-export credentials for spec files
export {
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
	TEST_AUTHOR1_CREDENTIALS,
	TEST_AUTHOR2_CREDENTIALS,
	TEST_AUTHOR3_CREDENTIALS,
	ADDITIONAL_TEST_USERS,
} from './worker-server.fixture';

export type { TestUserCredentials } from '@momentum-cms/e2e-fixtures';

// Accessibility helpers
export { checkA11y } from './axe-helpers';
