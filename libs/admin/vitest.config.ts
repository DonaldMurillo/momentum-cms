import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Admin library vitest config - runs Angular component tests
 */
export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.spec.ts'],
		exclude: ['**/node_modules/**'],
		passWithNoTests: true,
		alias: {
			'@momentumcms/core': resolve(__dirname, '../../libs/core/src/index.ts'),
			'@momentumcms/server-core': resolve(__dirname, '../../libs/server-core/src/index.ts'),
			'@momentumcms/admin': resolve(__dirname, './src/index.ts'),
			'@momentumcms/ui': resolve(__dirname, '../../libs/ui/src/index.ts'),
		},
	},
});
