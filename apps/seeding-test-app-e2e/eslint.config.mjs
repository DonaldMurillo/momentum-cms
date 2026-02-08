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
		},
	},
];
