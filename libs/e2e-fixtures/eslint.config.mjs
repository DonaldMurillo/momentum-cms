import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			// E2E fixtures are Node.js test helpers, not Angular code
			'local/no-direct-browser-apis': 'off',
		},
	},
];
