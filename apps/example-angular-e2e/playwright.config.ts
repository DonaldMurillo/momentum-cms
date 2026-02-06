import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

/**
 * Parallel Playwright configuration for Example Angular E2E Tests.
 *
 * - 4 concurrent workers, each with its own database and server
 * - Worker-scoped fixtures handle DB creation, server startup, and user setup
 * - globalSetup runs precondition checks (build artifact, PG reachable)
 * - No webServer block — workers spawn their own servers on random ports
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	...nxE2EPreset(__filename, { testDir: './src' }),

	// Fail the build if test.only is left in the source code on CI
	forbidOnly: !!process.env['CI'],

	// Retry failed tests on CI only
	retries: process.env['CI'] ? 2 : 0,

	// Run tests in parallel — each worker has its own isolated server + DB
	fullyParallel: true,

	// 4 concurrent workers for local development, 2 on CI for stability
	workers: process.env['CI'] ? 2 : 4,

	// Reporter configuration
	reporter: process.env['CI'] ? 'github' : 'html',

	// Precondition checks (build artifact exists, PG reachable, Mailpit running)
	globalSetup: require.resolve('./src/global-setup'),

	// Cleanup (stop Mailpit if we started it)
	globalTeardown: require.resolve('./src/global-teardown'),

	use: {
		// baseURL is provided per-worker by the worker fixture (random port)
		// No static baseURL here — it's overridden by the fixture

		// Strict timeouts - catch slow operations early
		actionTimeout: 10000,
		navigationTimeout: 30000,

		// Collect trace when retrying the failed test
		trace: 'on-first-retry',

		// Screenshot on failure
		screenshot: 'only-on-failure',

		// Video on retry
		video: 'on-first-retry',
	},

	// Global timeout for each test
	timeout: 30000,

	// Expect timeout
	expect: {
		timeout: 5000,
	},

	// No webServer — workers spawn their own servers via fixtures

	projects: [
		{
			name: 'default',
			testMatch: /\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
