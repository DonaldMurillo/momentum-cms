import nx from '@nx/eslint-plugin';
import localRules from './tools/eslint-local-rules/index.js';

export default [
	...nx.configs['flat/base'],
	...nx.configs['flat/typescript'],
	...nx.configs['flat/javascript'],
	{
		ignores: ['**/dist', '**/out-tsc', '**/node_modules'],
	},
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
		rules: {
			'@nx/enforce-module-boundaries': [
				'error',
				{
					enforceBuildableLibDependency: true,
					allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
					depConstraints: [
						{
							sourceTag: '*',
							onlyDependOnLibsWithTags: ['*'],
						},
					],
				},
			],
		},
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: {
			local: localRules,
		},
		rules: {
			// Strict TypeScript rules
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-assertions': [
				'error',
				{
					assertionStyle: 'never',
				},
			],
			'@typescript-eslint/explicit-function-return-type': [
				'error',
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true,
					allowHigherOrderFunctions: true,
					allowDirectConstAssertionInArrowFunctions: true,
				},
			],
			// '@typescript-eslint/no-floating-promises': 'error', // Requires type-aware linting setup
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],

			// Ban legacy Angular decorators
			'local/no-legacy-angular-decorators': 'error',

			// No console in production code
			'no-console': ['error', { allow: ['warn', 'error'] }],
		},
	},
	{
		// Relax rules for test files
		files: ['**/*.spec.ts', '**/*.test.ts', '**/e2e/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-assertions': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'no-console': 'off',
		},
	},
	{
		// Relax rules for config files
		files: ['**/*.config.ts', '**/*.config.mjs', '**/*.config.js', '**/vitest.config.ts'],
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@nx/enforce-module-boundaries': 'off',
		},
	},
];
