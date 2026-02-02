import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		files: ['**/*.json'],
		rules: {
			// Disable dependency checks - this library uses Angular which is provided by the app
			'@nx/dependency-checks': 'off',
		},
		languageOptions: {
			parser: await import('jsonc-eslint-parser'),
		},
	},
	...nx.configs['flat/angular'],
	...nx.configs['flat/angular-template'],
	{
		files: ['**/*.ts'],
		rules: {
			'@angular-eslint/directive-selector': [
				'error',
				{
					type: 'attribute',
					prefix: 'mcms',
					style: 'camelCase',
				},
			],
			'@angular-eslint/component-selector': [
				'error',
				{
					type: ['element', 'attribute'],
					prefix: 'mcms',
					style: 'kebab-case',
				},
			],
		},
	},
	{
		files: ['**/*.html'],
		rules: {
			// Disable label association check - radio groups handle this differently
			'@angular-eslint/template/label-has-associated-control': 'off',
		},
	},
];
