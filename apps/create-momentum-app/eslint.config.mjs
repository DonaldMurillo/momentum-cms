import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		ignores: ['templates/**', '**/templates/**'],
	},
	{
		files: ['**/*.ts'],
		rules: {
			'no-console': 'off',
		},
	},
];
