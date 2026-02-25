import { defineConfig, mergeConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import rootConfig from '../../vitest.config';

export default mergeConfig(
	rootConfig,
	defineConfig({
		plugins: [angular({ tsconfig: './tsconfig.spec.json' })],
		test: {
			include: ['src/**/*.spec.ts'],
			exclude: ['**/node_modules/**'],
		},
	}),
);
