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
				'@momentumcms/plugins-analytics/client': resolve(
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
						'@momentumcms/server-analog': resolve(
							__dirname,
							'../../libs/server-analog/src/index.ts',
						),
						'@momentumcms/server-core': resolve(__dirname, '../../libs/server-core/src/index.ts'),
						'@momentumcms/core': resolve(__dirname, '../../libs/core/src/index.ts'),
						'@momentumcms/db-drizzle': resolve(__dirname, '../../libs/db-drizzle/src/index.ts'),
						'@momentumcms/auth': resolve(__dirname, '../../libs/auth/src/index.ts'),
						'@momentumcms/email/templates': resolve(
							__dirname,
							'../../libs/email/src/lib/templates/default-templates.ts',
						),
						'@momentumcms/email/types': resolve(__dirname, '../../libs/email/src/types.ts'),
						'@momentumcms/email': resolve(__dirname, '../../libs/email/src/index.ts'),
						'@momentumcms/example-config/collections': resolve(
							__dirname,
							'../../libs/example-config/src/collections/index.ts',
						),
						'@momentumcms/example-config/globals': resolve(
							__dirname,
							'../../libs/example-config/src/globals/index.ts',
						),
						'@momentumcms/example-config': resolve(
							__dirname,
							'../../libs/example-config/src/index.ts',
						),
						'@momentumcms/plugins/core': resolve(__dirname, '../../libs/plugins/core/src/index.ts'),
						'@momentumcms/plugins/analytics': resolve(
							__dirname,
							'../../libs/plugins/analytics/src/index.ts',
						),
						'@momentumcms/plugins/seo': resolve(__dirname, '../../libs/plugins/seo/src/index.ts'),
						'@momentumcms/plugins/redirects': resolve(
							__dirname,
							'../../libs/plugins/redirects/src/index.ts',
						),
						'@momentumcms/plugins/email': resolve(
							__dirname,
							'../../libs/plugins/email/src/index.ts',
						),
						'@momentumcms/plugins/queue': resolve(
							__dirname,
							'../../libs/plugins/queue/src/index.ts',
						),
						'@momentumcms/plugins/cron': resolve(__dirname, '../../libs/plugins/cron/src/index.ts'),
						'@momentumcms/plugins-form-builder/collections': resolve(
							__dirname,
							'../../libs/plugins/form-builder/src/lib/collections/index.ts',
						),
						'@momentumcms/plugins-form-builder/admin-routes': resolve(
							__dirname,
							'../../libs/plugins/form-builder/src/lib/form-builder-admin-routes.ts',
						),
						'@momentumcms/plugins-form-builder': resolve(
							__dirname,
							'../../libs/plugins/form-builder/src/index.ts',
						),
						'@momentumcms/form-builder/validation': resolve(
							__dirname,
							'../../libs/form-builder/src/lib/validation/index.ts',
						),
						'@momentumcms/form-builder': resolve(__dirname, '../../libs/form-builder/src/index.ts'),
						'@momentumcms/queue': resolve(__dirname, '../../libs/queue/src/index.ts'),
						'@momentumcms/storage': resolve(__dirname, '../../libs/storage/src/index.ts'),
						'@momentumcms/logger': resolve(__dirname, '../../libs/logger/src/index.ts'),
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
