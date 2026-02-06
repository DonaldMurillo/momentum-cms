import type { Page } from '@playwright/test';
import { createAuthPageFixture, getWorkerAuthFilePath } from '@momentum-cms/e2e-fixtures';
import {
	workerTest,
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
} from './worker-server.fixture';
import * as path from 'node:path';

const PROJECT_DIR = path.resolve(__dirname, '..', '..');

/**
 * Get the auth file path for a user in the current worker.
 */
function authFileForWorker(email: string, workerIndex: number): string {
	return getWorkerAuthFilePath(PROJECT_DIR, workerIndex, email);
}

// Track workerIndex for auth fixtures
let currentWorkerIndex = 0;

/**
 * Extended test with worker server + per-role authenticated page fixtures.
 */
export const test = workerTest.extend<{
	authenticatedPage: Page;
	editorPage: Page;
	viewerPage: Page;
}>({
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
});

export { expect } from '@playwright/test';

// Re-export credentials for spec files
export {
	TEST_CREDENTIALS,
	TEST_EDITOR_CREDENTIALS,
	TEST_VIEWER_CREDENTIALS,
	ADDITIONAL_TEST_USERS,
} from './worker-server.fixture';

export type { TestUserCredentials } from '@momentum-cms/e2e-fixtures';
