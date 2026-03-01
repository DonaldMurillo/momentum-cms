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
			'apps/**/*.spec.ts', // App-level tests handled separately (migration-tests, etc.)
			'libs/admin/**/*.spec.ts', // Angular component tests handled separately (jsdom)
			'libs/ui/**/*.spec.ts', // Angular component tests handled separately (jsdom)
			'libs/email-builder/**/*.spec.ts', // Angular component tests handled separately
			'libs/form-builder/src/lib/components/**/*.spec.ts', // Angular component tests (jsdom)
			'libs/form-builder/src/lib/schema/schema-to-signal-form.spec.ts', // Angular TestBed (jsdom)
			'libs/form-builder/src/lib/services/**/*.spec.ts', // Angular services (jsdom)
			'libs/email/src/lib/components/**/*.spec.ts', // Angular SSR tests need AOT (own vitest config)
			'libs/e2e-tests/**/*.spec.ts', // Playwright E2E specs
			'libs/e2e-fixtures/**/*.spec.ts', // E2E fixture tests
			'libs/ui-e2e/**/*.spec.ts', // Storybook E2E specs
		],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			exclude: ['**/node_modules/**', '**/*.spec.ts', '**/*.test.ts', '**/e2e/**'],
			reportsDirectory: './coverage',
		},
		alias: {
			'@momentumcms/core': resolve(__dirname, 'libs/core/src/index.ts'),
			'@momentumcms/server-core': resolve(__dirname, 'libs/server-core/src/index.ts'),
			'@momentumcms/server-express': resolve(__dirname, 'libs/server-express/src/index.ts'),
			'@momentumcms/server-analog': resolve(__dirname, 'libs/server-analog/src/index.ts'),
			'@momentumcms/admin': resolve(__dirname, 'libs/admin/src/index.ts'),
			'@momentumcms/db-drizzle': resolve(__dirname, 'libs/db-drizzle/src/index.ts'),
			'@momentumcms/auth': resolve(__dirname, 'libs/auth/src/index.ts'),
			'@momentumcms/email': resolve(__dirname, 'libs/email/src/index.ts'),
			'@momentumcms/email-builder': resolve(__dirname, 'libs/email-builder/src/index.ts'),
			'@momentumcms/storage': resolve(__dirname, 'libs/storage/src/index.ts'),
			'@momentumcms/logger': resolve(__dirname, 'libs/logger/src/index.ts'),
			'@momentumcms/plugins/core': resolve(__dirname, 'libs/plugins/core/src/index.ts'),
			'@momentumcms/plugins/otel': resolve(__dirname, 'libs/plugins/otel/src/index.ts'),
			'@momentumcms/plugins/analytics': resolve(__dirname, 'libs/plugins/analytics/src/index.ts'),
			'@momentumcms/migrations': resolve(__dirname, 'libs/migrations/src/index.ts'),
			'@momentumcms/example-config': resolve(__dirname, 'libs/example-config/src/index.ts'),
			'@momentumcms/example-config/collections': resolve(
				__dirname,
				'libs/example-config/src/collections/index.ts',
			),
			'@momentumcms/form-builder': resolve(__dirname, 'libs/form-builder/src/index.ts'),
			'@momentumcms/form-builder/validation': resolve(
				__dirname,
				'libs/form-builder/src/lib/validation/index.ts',
			),
		},
	},
});
