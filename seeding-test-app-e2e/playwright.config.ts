import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4001';

/**
 * Playwright configuration for Seeding E2E Tests.
 *
 * - Serial execution for database state consistency
 * - Single worker to prevent race conditions
 * - Global setup resets database and waits for seeds
 * - Uses production build for realistic testing
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	...nxE2EPreset(__filename, { testDir: './src' }),

	// Fail the build if test.only is left in the source code on CI
	forbidOnly: !!process.env['CI'],

	// Retry failed tests on CI only
	retries: process.env['CI'] ? 2 : 0,

	// Run tests serially for database state consistency
	fullyParallel: false,

	// Single worker to prevent race conditions with shared database
	workers: 1,

	// Reporter configuration
	reporter: process.env['CI'] ? 'github' : 'html',

	// Global setup resets database before tests
	globalSetup: require.resolve('./src/global-setup'),

	use: {
		baseURL,

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

	// Run production server (nx builds the app as a dependency before running e2e)
	webServer: {
		command: 'node dist/seeding-test-app/server/server.mjs',
		url: 'http://localhost:4001/api/health',
		reuseExistingServer: !process.env['CI'],
		cwd: workspaceRoot,
		timeout: 60000,
	},

	projects: [
		// Basic seeding tests - run first to verify data is seeded
		{
			name: 'seeding-basic',
			testMatch: /seeding-basic\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
		},
		// Idempotency tests - depend on basic tests
		{
			name: 'seeding-idempotency',
			testMatch: /seeding-idempotency\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-basic'],
		},
		// Custom seed function tests
		{
			name: 'seeding-custom',
			testMatch: /seeding-custom\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-idempotency'],
		},
		// Seed tracking table tests
		{
			name: 'seeding-tracking',
			testMatch: /seeding-tracking\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-custom'],
		},
		// Versioning tests - tests version/draft functionality
		{
			name: 'versioning',
			testMatch: /versioning\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Media upload tests (tests file upload/storage)
		{
			name: 'media-upload',
			testMatch: /media-upload\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['versioning'],
		},
		// Auth tests - run after seeding tests, tests unauthenticated behavior
		{
			name: 'auth-tests',
			testMatch: /auth\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
				// No storage state - tests unauthenticated behavior
			},
			dependencies: ['seeding-tracking'],
		},
		// Authenticated tests - admin dashboard, collections
		{
			name: 'authenticated-tests',
			testMatch: /(admin-dashboard|collection-list|collection-edit)\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
			dependencies: ['auth-tests'],
		},
		// Password reset tests - require Mailpit running
		// Run LAST because the full flow test changes the admin password
		{
			name: 'password-reset-tests',
			testMatch: /password-reset\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
				// No storage state - tests unauthenticated behavior
			},
			dependencies: ['authenticated-tests'],
		},
	],
});
