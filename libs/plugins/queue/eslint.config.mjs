import baseConfig from '../../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		files: ['**/*.ts'],
		rules: {
			'local/no-direct-browser-apis': 'off',
		},
	},
	{
		files: ['**/*.json'],
		rules: {
			'@nx/dependency-checks': [
				'error',
				{
					ignoredFiles: [
						'{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
						'{projectRoot}/esbuild.config.{js,ts,mjs,mts}',
						'{projectRoot}/vitest.config.{js,ts,mjs,mts}',
					],
					ignoredDependencies: ['pg'],
				},
			],
		},
		languageOptions: {
			parser: await import('jsonc-eslint-parser'),
		},
	},
];
