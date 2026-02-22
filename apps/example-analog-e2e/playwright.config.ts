import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import * as path from 'node:path';

const E2E_TESTS_LIB = path.resolve(__dirname, '../../libs/e2e-tests/src');

// Set flavor environment variables for the unified E2E library
process.env['E2E_SERVER_FLAVOR'] = process.env['E2E_SERVER_FLAVOR'] ?? 'analog';
process.env['E2E_PROJECT_DIR'] = process.env['E2E_PROJECT_DIR'] ?? path.resolve(__dirname);
process.env['E2E_WORKSPACE_ROOT'] =
	process.env['E2E_WORKSPACE_ROOT'] ?? path.resolve(__dirname, '..', '..');

/**
 * Playwright configuration for Example Analog E2E Tests.
 *
 * Uses the unified test library (libs/e2e-tests) with E2E_SERVER_FLAVOR=analog.
 * Worker-scoped fixtures handle DB creation, server startup, and user setup.
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	...nxE2EPreset(__filename, { testDir: path.join(E2E_TESTS_LIB, 'specs') }),

	// Fail the build if test.only is left in the source code on CI
	forbidOnly: !!process.env['CI'],

	// Retry failed tests (2 on CI, 2 locally for SSR hydration timing)
	retries: process.env['CI'] ? 2 : 2,

	// Run tests in parallel — each worker has its own isolated server + DB
	fullyParallel: true,

	// 4 concurrent workers for local development, 2 on CI for stability
	workers: process.env['CI'] ? 2 : 4,

	// Reporter configuration
	reporter: process.env['CI'] ? 'github' : 'html',

	// Precondition checks from shared library (build artifact, PG, Mailpit)
	globalSetup: require.resolve(path.join(E2E_TESTS_LIB, 'global-setup')),

	// Cleanup (stop Mailpit if we started it)
	globalTeardown: require.resolve(path.join(E2E_TESTS_LIB, 'global-teardown')),

	use: {
		// baseURL is provided per-worker by the worker fixture (random port)
		actionTimeout: 10000,
		navigationTimeout: 30000,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'on-first-retry',
	},

	timeout: 30000,

	expect: {
		timeout: 5000,
	},

	projects: [
		{
			name: 'default',
			testMatch: /\.spec\.ts$/,
			testIgnore: [
				// Analog app doesn't have /articles frontend routes
				'**/articles-page.spec.ts',
				// Analog app doesn't have the same frontend shell layout (header/footer/nav)
				'**/page-rendering.spec.ts',
			],
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
