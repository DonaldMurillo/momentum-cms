import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		// Test helper infrastructure: adapter-wiring uses type assertions for DB adapter bridging
		// (pg.Pool.query returns any[], better-sqlite3 returns unknown[] — casts are unavoidable)
		files: ['**/helpers/**/*.ts'],
		rules: {
			'@typescript-eslint/consistent-type-assertions': 'off',
			'@typescript-eslint/no-empty-function': 'off',
		},
	},
	{
		// Spec files: allow empty no-op functions (intentionally empty down() migrations, pool error handlers, etc.)
		files: ['**/*.spec.ts', '**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-empty-function': 'off',
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
						'{projectRoot}/vitest.config.{js,ts,mjs,mts}',
					],
				},
			],
		},
		languageOptions: {
			parser: await import('jsonc-eslint-parser'),
		},
	},
];
