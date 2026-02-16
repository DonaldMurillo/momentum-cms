import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
	{
		files: ['**/*.ts'],
		extends: [...tseslint.configs.recommended, ...angular.configs.tsRecommended],
		rules: {
			'@angular-eslint/directive-selector': [
				'error',
				{
					type: 'attribute',
					prefix: 'app',
					style: 'camelCase',
				},
			],
			'@angular-eslint/component-selector': [
				'error',
				{
					type: 'element',
					prefix: 'app',
					style: 'kebab-case',
				},
			],
		},
	},
	{
		files: ['**/*.html'],
		extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
	},
);
