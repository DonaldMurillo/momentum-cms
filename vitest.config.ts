import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['libs/**/*.spec.ts'],
		exclude: [
			'**/node_modules/**',
			'**/e2e/**',
			'apps/**/*.spec.ts', // Angular component tests handled separately
			'libs/admin/**/*.spec.ts', // Angular component tests handled separately
		],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			exclude: ['**/node_modules/**', '**/*.spec.ts', '**/*.test.ts', '**/e2e/**'],
			reportsDirectory: './coverage',
		},
		alias: {
			'@momentum-cms/core': resolve(__dirname, 'libs/core/src/index.ts'),
			'@momentum-cms/server-core': resolve(__dirname, 'libs/server-core/src/index.ts'),
			'@momentum-cms/server-express': resolve(__dirname, 'libs/server-express/src/index.ts'),
			'@momentum-cms/server-analog': resolve(__dirname, 'libs/server-analog/src/index.ts'),
			'@momentum-cms/admin': resolve(__dirname, 'libs/admin/src/index.ts'),
			'@momentum-cms/db-drizzle': resolve(__dirname, 'libs/db-drizzle/src/index.ts'),
			'@momentum-cms/auth': resolve(__dirname, 'libs/auth/src/index.ts'),
			'@momentum-cms/storage': resolve(__dirname, 'libs/storage/src/index.ts'),
			'@momentum-cms/logger': resolve(__dirname, 'libs/logger/src/index.ts'),
			'@momentum-cms/plugins': resolve(__dirname, 'libs/plugins/src/index.ts'),
			'@momentum-cms/plugin-otel': resolve(__dirname, 'libs/plugin-otel/src/index.ts'),
			'@momentum-cms/analytics': resolve(__dirname, 'libs/analytics/src/index.ts'),
		},
	},
});
