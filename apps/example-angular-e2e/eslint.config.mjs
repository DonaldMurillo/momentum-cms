import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
	playwright.configs['flat/recommended'],
	...baseConfig,
	{
		files: ['**/*.ts', '**/*.js'],
		rules: {
			// E2E test code is not Angular — browser API rule does not apply
			'local/no-direct-browser-apis': 'off',

			// Allow conditionals in tests for auth-aware test skipping
			// This pattern is intentional: tests check auth state and skip gracefully
			'playwright/no-conditional-in-test': 'off',
			'playwright/no-conditional-expect': 'off',

			// Allow test.skip() for auth-aware tests that need to skip when not authenticated
			'playwright/no-skipped-test': 'off',

			// networkidle is useful for SSR apps where we need hydration to complete
			// Using domcontentloaded alone isn't sufficient for Angular SSR
			'playwright/no-networkidle': 'warn',

			// Ban waitForTimeout() — use expect(locator).toBeVisible({ timeout }) or expect.poll()
			'playwright/no-wait-for-timeout': 'error',
		},
	},
];
