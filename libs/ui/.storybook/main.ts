import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
	stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
	framework: {
		name: getAbsolutePath('@storybook/angular'),
		options: {},
	},
	docs: {},
	webpackFinal: async (config) => {
		// Add PostCSS with Tailwind support
		const cssRules = config.module?.rules?.filter(
			(rule) => rule && typeof rule === 'object' && rule.test?.toString().includes('css'),
		);

		if (cssRules && cssRules.length > 0) {
			for (const rule of cssRules) {
				if (rule && typeof rule === 'object' && Array.isArray(rule.use)) {
					const postcssLoaderIndex = rule.use.findIndex((loader) => {
						if (loader === null || typeof loader !== 'object') return false;
						if (!('loader' in loader)) return false;
						const loaderPath = loader.loader;
						return typeof loaderPath === 'string' && loaderPath.includes('postcss-loader');
					});

					if (postcssLoaderIndex !== -1) {
						const loader = rule.use[postcssLoaderIndex];
						if (loader !== null && typeof loader === 'object' && 'options' in loader) {
							const loaderWithOptions = loader;
							const existingOptions =
								typeof loaderWithOptions.options === 'object' && loaderWithOptions.options !== null
									? loaderWithOptions.options
									: {};
							loaderWithOptions.options = {
								...existingOptions,
								postcssOptions: {
									plugins: [
										require('tailwindcss')({
											config: join(__dirname, '../tailwind.config.js'),
										}),
										require('autoprefixer'),
									],
								},
							};
						}
					}
				}
			}
		}

		return config;
	},
};

export default config;

function getAbsolutePath(value: string): string {
	return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
