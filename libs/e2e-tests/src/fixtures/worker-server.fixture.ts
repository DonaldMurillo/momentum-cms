import { createWorkerFixture } from '@momentum-cms/e2e-fixtures';
import * as path from 'node:path';
import { getFlavorConfig, TEST_CREDENTIALS, ADDITIONAL_TEST_USERS } from './worker-config';

const flavorConfig = getFlavorConfig();

/**
 * Resolve PROJECT_DIR dynamically.
 *
 * When running from an app E2E shell (e.g. apps/example-angular-e2e),
 * the playwright config points testDir to this library.
 * The workspace root is two levels up from the app E2E project.
 *
 * We use E2E_PROJECT_DIR env var set by the app-specific playwright config,
 * falling back to a default relative path from this file.
 */
const PROJECT_DIR = process.env['E2E_PROJECT_DIR']
	? path.resolve(process.env['E2E_PROJECT_DIR'])
	: path.resolve(__dirname, '..', '..', '..', '..');
const WORKSPACE_ROOT = process.env['E2E_WORKSPACE_ROOT']
	? path.resolve(process.env['E2E_WORKSPACE_ROOT'])
	: PROJECT_DIR;

/**
 * Worker-scoped fixture parameterized by E2E_SERVER_FLAVOR.
 * Each worker gets its own database, server, and set of test users.
 */
export const workerTest = createWorkerFixture({
	appName: flavorConfig.appName,
	serverBinary: flavorConfig.serverBinary,
	healthEndpoint: flavorConfig.healthEndpoint,
	waitForSeeds: flavorConfig.waitForSeeds,
	adminUser: TEST_CREDENTIALS,
	additionalUsers: ADDITIONAL_TEST_USERS,
	smtpEnv: true,
	projectDir: PROJECT_DIR,
	workspaceRoot: WORKSPACE_ROOT,
});
