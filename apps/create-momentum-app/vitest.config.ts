import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		root: resolve(__dirname),
		include: ['src/**/*.spec.ts'],
		exclude: ['**/node_modules/**'],
		testTimeout: 30000,
	},
});
