import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

/**
 * Parallel Playwright configuration for Seeding E2E Tests.
 *
 * - 4 concurrent workers, each with its own database and server
 * - Worker-scoped fixtures handle DB creation, server startup, and user setup
 * - No webServer block — workers spawn their own servers on random ports
 * - globalSetup runs precondition checks (build artifact, PG reachable)
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

	// Precondition checks (build artifact exists, PG reachable)
	globalSetup: require.resolve('./src/global-setup'),

	// No webServer — workers spawn their own servers via fixtures

	projects: [
		// Default project — all tests run in parallel across workers
		{
			name: 'default',
			testMatch: /\.spec\.ts$/,
			testIgnore: /(email-verification|password-reset)\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
		},
		// Email tests — need Mailpit running
		{
			name: 'email-tests',
			testMatch: /(email-verification|password-reset)\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
