import nx from '@nx/eslint-plugin';
import localRules from './tools/eslint-local-rules/index.js';

export default [
	...nx.configs['flat/base'],
	...nx.configs['flat/typescript'],
	...nx.configs['flat/javascript'],
	{
		ignores: [
			'**/dist',
			'**/out-tsc',
			'**/node_modules',
			'**/vitest.config.*.timestamp*',
			'**/templates/**',
		],
	},
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
		rules: {
			'@nx/enforce-module-boundaries': [
				'error',
				{
					enforceBuildableLibDependency: true,
					allow: [
						'^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
						// Browser-safe sub-paths from server-tagged libs
						'@momentumcms/auth/core',
						'@momentumcms/auth/collections',
						'@momentumcms/plugins/analytics',
						'@momentumcms/plugins/analytics/dashboard',
						'@momentumcms/plugins/analytics/admin-routes',
						'@momentumcms/plugins/analytics/client',
						'@momentumcms/plugins/analytics/block-fields',
						// Email plugin browser-safe sub-paths
						'@momentumcms/plugins/email',
						'@momentumcms/plugins-email/admin-routes',
						// Email lib exports browser-safe types used by email-builder
						'@momentumcms/email',
						'@momentumcms/email/templates',
						// Example config sub-paths (mixed lazy/static usage in apps)
						'@momentumcms/example-config',
						'@momentumcms/example-config/collections',
						'@momentumcms/example-config/globals',
						'@momentumcms/example-config/pages',
					],
					depConstraints: [
						// Environment boundaries
						{
							sourceTag: 'env:browser',
							onlyDependOnLibsWithTags: ['env:browser', 'env:universal'],
						},
						{
							sourceTag: 'env:server',
							onlyDependOnLibsWithTags: ['env:server', 'env:universal'],
						},
						{
							sourceTag: 'env:universal',
							onlyDependOnLibsWithTags: ['env:universal'],
						},
						// Scope rules
						{
							sourceTag: 'scope:app',
							onlyDependOnLibsWithTags: ['*'],
						},
						{
							sourceTag: 'scope:plugin',
							onlyDependOnLibsWithTags: ['scope:lib', 'scope:plugin-infra'],
						},
						{
							sourceTag: 'scope:plugin-infra',
							onlyDependOnLibsWithTags: ['scope:lib', 'scope:plugin-infra'],
						},
						{
							sourceTag: 'scope:lib',
							onlyDependOnLibsWithTags: ['scope:lib', 'scope:plugin-infra'],
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

			// Ban redundant standalone: true (default in Angular 21+)
			'local/no-standalone-true': 'error',

			// No console in production code
			'no-console': ['error', { allow: ['warn', 'error'] }],

			// Ban direct browser API usage (window, document, setTimeout, etc.)
			// Use inject(DOCUMENT) and .defaultView for SSR safety
			'local/no-direct-browser-apis': 'error',
		},
	},
	{
		// Relax rules for test and story files
		files: ['**/*.spec.ts', '**/*.test.ts', '**/e2e/**/*.ts', '**/*.stories.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-assertions': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'no-console': 'off',
			'local/no-direct-browser-apis': 'off',
		},
	},
	{
		// Relax rules for config files
		files: ['**/*.config.ts', '**/*.config.mjs', '**/*.config.js', '**/vitest.config.ts'],
		rules: {
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@nx/enforce-module-boundaries': 'off',
			'local/no-direct-browser-apis': 'off',
		},
	},
	{
		// Server-side code legitimately uses browser-like globals (setTimeout, setInterval in Node)
		files: [
			'libs/server-core/**/*.ts',
			'libs/server-express/**/*.ts',
			'libs/server-analog/**/*.ts',
		],
		rules: {
			'local/no-direct-browser-apis': 'off',
		},
	},
	{
		// CLI tools and Node.js scripts legitimately use console.log and setTimeout
		files: ['apps/create-momentum-app/src/**/*.ts', 'scripts/**/*.ts'],
		rules: {
			'no-console': 'off',
			'local/no-direct-browser-apis': 'off',
		},
	},
];
