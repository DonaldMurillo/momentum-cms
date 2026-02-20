import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	root: __dirname,
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.spec.ts'],
		testTimeout: 30000,
		hookTimeout: 30000,
		pool: 'forks',
		maxForks: 1,
		minForks: 1,
		alias: [
			{
				find: '@momentumcms/example-config/collections',
				replacement: resolve(__dirname, '../../libs/example-config/src/collections/index.ts'),
			},
			{
				find: '@momentumcms/example-config',
				replacement: resolve(__dirname, '../../libs/example-config/src/index.ts'),
			},
			{
				find: '@momentumcms/plugins/core',
				replacement: resolve(__dirname, '../../libs/plugins/core/src/index.ts'),
			},
			{
				find: '@momentumcms/plugins/analytics',
				replacement: resolve(__dirname, '../../libs/plugins/analytics/src/index.ts'),
			},
			{
				find: '@momentumcms/core',
				replacement: resolve(__dirname, '../../libs/core/src/index.ts'),
			},
			{
				find: '@momentumcms/server-core',
				replacement: resolve(__dirname, '../../libs/server-core/src/index.ts'),
			},
			{
				find: '@momentumcms/server-express',
				replacement: resolve(__dirname, '../../libs/server-express/src/index.ts'),
			},
			{
				find: '@momentumcms/db-drizzle',
				replacement: resolve(__dirname, '../../libs/db-drizzle/src/index.ts'),
			},
			{
				find: '@momentumcms/auth',
				replacement: resolve(__dirname, '../../libs/auth/src/index.ts'),
			},
			{
				find: '@momentumcms/storage',
				replacement: resolve(__dirname, '../../libs/storage/src/index.ts'),
			},
			{
				find: '@momentumcms/logger',
				replacement: resolve(__dirname, '../../libs/logger/src/index.ts'),
			},
			{
				find: '@momentumcms/migrations',
				replacement: resolve(__dirname, '../../libs/migrations/src/index.ts'),
			},
		],
	},
});
