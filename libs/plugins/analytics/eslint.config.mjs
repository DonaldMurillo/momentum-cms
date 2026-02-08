import baseConfig from '../../../eslint.config.mjs';

export default [
	...baseConfig,
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
						'{projectRoot}/src/lib/dashboard/**',
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
