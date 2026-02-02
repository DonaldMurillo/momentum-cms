import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4000';

/**
 * Strict Playwright configuration for E2E testing.
 * - No mocks allowed - tests run against real server
 * - Strict timeouts to catch slow operations
 * - CI-aware retries and parallelization
 * - Global setup creates admin user before tests
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	...nxE2EPreset(__filename, { testDir: './src' }),

	// Fail the build if test.only is left in the source code on CI
	forbidOnly: !!process.env['CI'],

	// Retry failed tests on CI only
	retries: process.env['CI'] ? 2 : 0,

	// Run tests in parallel
	fullyParallel: true,

	// Limit workers on CI for stability
	workers: process.env['CI'] ? 1 : undefined,

	// Reporter configuration
	reporter: process.env['CI'] ? 'github' : 'html',

	// Global setup runs once before all tests - creates admin user
	globalSetup: require.resolve('./src/global-setup'),

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		baseURL,

		// Strict timeouts - catch slow operations early
		actionTimeout: 10000,
		navigationTimeout: 30000,

		// Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
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

	/* Run the production server before starting the tests - NO MOCKS */
	webServer: {
		command:
			'npx nx build example-angular --configuration=production && node dist/apps/example-angular/server/server.mjs',
		url: 'http://localhost:4000',
		reuseExistingServer: !process.env['CI'],
		cwd: workspaceRoot,
		timeout: 180000,
	},

	projects: [
		// Auth tests run without storage state to test login/logout flows
		{
			name: 'auth-tests',
			testMatch: /auth\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
				// No storage state - tests unauthenticated behavior
			},
		},
		// General tests (example.spec.ts, api.spec.ts) run without storage state
		{
			name: 'general-tests',
			testMatch: /(example|api)\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
				// No storage state - tests handle auth as needed
			},
		},
		// Authenticated tests - auth fixture loads storage state from global setup
		{
			name: 'authenticated-tests',
			testMatch: /(admin-dashboard|collection-list|collection-edit)\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],
});
