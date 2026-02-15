import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			// E2E tests and fixtures are Node.js/Playwright code, not Angular code
			'local/no-direct-browser-apis': 'off',
		},
	},
];
