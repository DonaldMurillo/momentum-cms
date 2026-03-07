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

			// E2E specs import shared fixtures via relative path (no npm scope alias)
			'@nx/enforce-module-boundaries': 'off',

			// Allow conditionals in tests for auth-aware test skipping
			'playwright/no-conditional-in-test': 'off',
			'playwright/no-conditional-expect': 'off',

			// Allow test.skip() for auth-aware tests that need to skip when not authenticated
			'playwright/no-skipped-test': 'off',

			// networkidle is useful for SSR apps where we need hydration to complete
			'playwright/no-networkidle': 'warn',

			// Ban waitForTimeout() — use expect(locator).toBeVisible({ timeout }) or expect.poll()
			'playwright/no-wait-for-timeout': 'error',
		},
	},
];
