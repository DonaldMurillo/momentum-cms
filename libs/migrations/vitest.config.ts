import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		root: __dirname,
		include: ['src/**/*.spec.ts'],
		exclude: ['**/node_modules/**'],
		alias: {
			'@momentumcms/core': resolve(__dirname, '../../libs/core/src/index.ts'),
			'@momentumcms/server-core': resolve(__dirname, '../../libs/server-core/src/index.ts'),
			'@momentumcms/server-express': resolve(
				__dirname,
				'../../libs/server-express/src/index.ts',
			),
			'@momentumcms/db-drizzle': resolve(__dirname, '../../libs/db-drizzle/src/index.ts'),
			'@momentumcms/auth': resolve(__dirname, '../../libs/auth/src/index.ts'),
			'@momentumcms/storage': resolve(__dirname, '../../libs/storage/src/index.ts'),
			'@momentumcms/logger': resolve(__dirname, '../../libs/logger/src/index.ts'),
			'@momentumcms/plugins/core': resolve(
				__dirname,
				'../../libs/plugins/core/src/index.ts',
			),
			'@momentumcms/plugins/analytics': resolve(
				__dirname,
				'../../libs/plugins/analytics/src/index.ts',
			),
			'@momentumcms/migrations': resolve(__dirname, '../../libs/migrations/src/index.ts'),
			'@momentumcms/example-config': resolve(
				__dirname,
				'../../libs/example-config/src/index.ts',
			),
			'@momentumcms/example-config/collections': resolve(
				__dirname,
				'../../libs/example-config/src/collections/index.ts',
			),
		},
	},
});
