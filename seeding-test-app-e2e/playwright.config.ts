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
		env: {
			...process.env,
			// Enable email features when Mailpit is running
			SMTP_HOST: process.env['SMTP_HOST'] ?? 'localhost',
			SMTP_PORT: process.env['SMTP_PORT'] ?? '1025',
			SMTP_FROM: process.env['SMTP_FROM'] ?? 'noreply@momentum.local',
		},
	},

	projects: [
		// Multi-user setup verification - run first to verify all users exist
		{
			name: 'multi-user-setup',
			testMatch: /multi-user-setup\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
		},
		// Basic seeding tests - run after user setup is verified
		{
			name: 'seeding-basic',
			testMatch: /seeding-basic\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['multi-user-setup'],
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
		// Group field tests - tests group field rendering and data storage
		{
			name: 'group-field',
			testMatch: /group-field\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Array field tests - tests array field data storage and CRUD
		{
			name: 'array-field',
			testMatch: /array-field\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Blocks field tests - tests blocks field data storage and CRUD
		{
			name: 'blocks-field',
			testMatch: /blocks-field\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Relationship field tests - tests relationship field storage and CRUD
		{
			name: 'relationship-field',
			testMatch: /relationship-field\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Layout field tests - tests tabs, collapsible, row layout fields
		{
			name: 'layout-fields',
			testMatch: /layout-fields\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Custom endpoints tests - tests collection-level custom endpoints
		{
			name: 'custom-endpoints',
			testMatch: /custom-endpoints\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Transaction tests - tests commit/rollback behavior
		{
			name: 'transactions',
			testMatch: /transactions\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Webhook tests - tests webhook dispatch on CRUD events
		{
			name: 'webhooks',
			testMatch: /webhooks\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Batch operations tests - tests batch create/update/delete
		{
			name: 'batch-operations',
			testMatch: /batch-operations\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Rich text field tests - tests HTML storage and TipTap editor
		{
			name: 'rich-text-field',
			testMatch: /rich-text-field\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Version diff tests - tests version comparison API and diff dialog UI
		{
			name: 'version-diff',
			testMatch: /version-diff\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Scheduled publishing tests - tests schedule, cancel, and auto-publish
		{
			name: 'scheduled-publishing',
			testMatch: /scheduled-publishing\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Live preview tests - tests preview panel, device toggle, postMessage sync
		{
			name: 'live-preview',
			testMatch: /live-preview\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// Full-text search tests - tests search endpoint with tsvector/tsquery
		{
			name: 'full-text-search',
			testMatch: /full-text-search\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
		},
		// GraphQL API tests - tests auto-generated schema, queries, mutations
		{
			name: 'graphql',
			testMatch: /graphql\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] },
			dependencies: ['seeding-tracking'],
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
		// Email verification tests - require Mailpit running
		{
			name: 'email-verification',
			testMatch: /email-verification\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
			dependencies: ['seeding-tracking'],
		},
		// OAuth provider tests - tests provider discovery and UI wiring
		{
			name: 'oauth-providers',
			testMatch: /oauth-providers\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
			dependencies: ['seeding-tracking'],
		},
		// Two-factor authentication tests - tests 2FA enable/verify/disable
		{
			name: 'two-factor-auth',
			testMatch: /two-factor-auth\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
			dependencies: ['seeding-tracking'],
		},
		// API keys tests - tests API key CRUD and authentication
		{
			name: 'api-keys',
			testMatch: /api-keys\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
			dependencies: ['seeding-tracking'],
		},
		// OpenAPI docs tests - tests auto-generated spec and Swagger UI
		// No dependencies - these tests only hit unauthenticated endpoints
		{
			name: 'openapi-docs',
			testMatch: /openapi-docs\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
		},
		// Import/Export tests - tests JSON/CSV export and import
		// No seeding-chain dependencies - only needs global setup for test users
		{
			name: 'import-export',
			testMatch: /import-export\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
		},
		// Accessibility tests - verify WCAG 2.1 AA ARIA attributes
		{
			name: 'accessibility',
			testMatch: /accessibility\.spec\.ts$/,
			use: {
				...devices['Desktop Chrome'],
			},
			dependencies: ['seeding-tracking'],
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
