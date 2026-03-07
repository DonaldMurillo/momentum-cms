import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import * as path from 'node:path';

const E2E_TESTS_LIB = path.resolve(__dirname, '../../libs/e2e-tests/src');

// Set flavor environment variables for the unified E2E library
process.env['E2E_SERVER_FLAVOR'] = process.env['E2E_SERVER_FLAVOR'] ?? 'swappable-admin';
process.env['E2E_PROJECT_DIR'] = process.env['E2E_PROJECT_DIR'] ?? path.resolve(__dirname);
process.env['E2E_WORKSPACE_ROOT'] =
	process.env['E2E_WORKSPACE_ROOT'] ?? path.resolve(__dirname, '..', '..');

/**
 * Playwright configuration for Swappable Admin E2E Tests.
 *
 * Uses the unified test library (libs/e2e-tests) with E2E_SERVER_FLAVOR=swappable-admin.
 * Worker-scoped fixtures handle DB creation, server startup, and user setup.
 */
export default defineConfig({
	...nxE2EPreset(__filename, { testDir: './src' }),

	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 2 : 2,
	fullyParallel: true,
	workers: process.env['CI'] ? 2 : 4,
	reporter: process.env['CI'] ? 'github' : 'html',

	globalSetup: require.resolve(path.join(E2E_TESTS_LIB, 'global-setup')),
	globalTeardown: require.resolve(path.join(E2E_TESTS_LIB, 'global-teardown')),

	use: {
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
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
