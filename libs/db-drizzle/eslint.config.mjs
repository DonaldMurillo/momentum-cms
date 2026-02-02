import baseConfig from '../../eslint.config.mjs';

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
					],
					// drizzle-orm is a peer dependency used for types and adapter compatibility
					ignoredDependencies: ['drizzle-orm'],
				},
			],
		},
		languageOptions: {
			parser: await import('jsonc-eslint-parser'),
		},
	},
];
