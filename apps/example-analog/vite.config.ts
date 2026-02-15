/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode: _mode }) => {
	return {
		root: __dirname,
		cacheDir: `../../node_modules/.vite`,
		resolve: {
			alias: {
				// Vite client build doesn't resolve tsconfig subpath patterns that share a prefix
				// with Nitro aliases. Explicitly resolve the analytics client subpath so the
				// tracker + rule engine are bundled into the browser build.
				'@momentum-cms/plugins/analytics/client': resolve(
					__dirname,
					'../../libs/plugins/analytics/src/lib/client/tracker.ts',
				),
			},
		},
		build: {
			outDir: '../../dist/apps/example-analog/client',
			reportCompressedSize: true,
			target: ['es2020'],
		},
		server: {
			fs: {
				allow: ['.'],
			},
		},
		plugins: [
			analog({
				nitro: {
					// Serve Storybook static files at /storybook
					publicAssets: [
						{
							dir: resolve(__dirname, '../../dist/storybook/ui'),
							baseURL: '/storybook',
							maxAge: 31536000,
						},
					],
					// Configure Nitro to resolve monorepo packages
					alias: {
						'@momentum-cms/server-analog': resolve(
							__dirname,
							'../../libs/server-analog/src/index.ts',
						),
						'@momentum-cms/server-core': resolve(__dirname, '../../libs/server-core/src/index.ts'),
						'@momentum-cms/core': resolve(__dirname, '../../libs/core/src/index.ts'),
						'@momentum-cms/db-drizzle': resolve(__dirname, '../../libs/db-drizzle/src/index.ts'),
						'@momentum-cms/auth': resolve(__dirname, '../../libs/auth/src/index.ts'),
						'@momentum-cms/example-config/collections': resolve(
							__dirname,
							'../../libs/example-config/src/collections/index.ts',
						),
						'@momentum-cms/example-config/globals': resolve(
							__dirname,
							'../../libs/example-config/src/globals/index.ts',
						),
						'@momentum-cms/example-config': resolve(
							__dirname,
							'../../libs/example-config/src/index.ts',
						),
						'@momentum-cms/plugins/core': resolve(
							__dirname,
							'../../libs/plugins/core/src/index.ts',
						),
						'@momentum-cms/plugins/analytics': resolve(
							__dirname,
							'../../libs/plugins/analytics/src/index.ts',
						),
						'@momentum-cms/storage': resolve(__dirname, '../../libs/storage/src/index.ts'),
						'@momentum-cms/logger': resolve(__dirname, '../../libs/logger/src/index.ts'),
					},
				},
			}),
			nxViteTsPaths(),
		],
		test: {
			globals: true,
			environment: 'jsdom',
			setupFiles: ['src/test-setup.ts'],
			include: ['**/*.spec.ts'],
			reporters: ['default'],
		},
	};
});
