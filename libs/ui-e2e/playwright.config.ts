import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4400';

/**
 * Playwright configuration for Storybook E2E tests.
 * Verifies that Storybook is running correctly and components render.
 */
export default defineConfig({
	...nxE2EPreset(__filename, { testDir: './src' }),

	forbidOnly: !!process.env['CI'],
	retries: process.env['CI'] ? 2 : 0,
	fullyParallel: true,
	workers: process.env['CI'] ? 1 : undefined,
	reporter: process.env['CI'] ? 'github' : 'html',

	use: {
		baseURL,
		actionTimeout: 10000,
		navigationTimeout: 30000,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},

	timeout: 60000,

	expect: {
		timeout: 10000,
	},

	webServer: {
		command: 'npx nx storybook ui',
		url: 'http://localhost:4400',
		reuseExistingServer: !process.env['CI'],
		cwd: workspaceRoot,
		timeout: 180000,
	},

	projects: [
		{
			name: 'storybook-tests',
			use: {
				...devices['Desktop Chrome'],
			},
		},
	],
});
