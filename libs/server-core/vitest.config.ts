import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const workspaceRoot = resolve(__dirname, '../..');

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.spec.ts'],
		exclude: ['**/node_modules/**'],
		alias: {
			'@momentumcms/core': resolve(workspaceRoot, 'libs/core/src/index.ts'),
			'@momentumcms/server-core': resolve(workspaceRoot, 'libs/server-core/src/index.ts'),
			'@momentumcms/server-express': resolve(workspaceRoot, 'libs/server-express/src/index.ts'),
			'@momentumcms/server-analog': resolve(workspaceRoot, 'libs/server-analog/src/index.ts'),
			'@momentumcms/server-nestjs': resolve(workspaceRoot, 'libs/server-nestjs/src/index.ts'),
			'@momentumcms/db-drizzle': resolve(workspaceRoot, 'libs/db-drizzle/src/index.ts'),
			'@momentumcms/auth': resolve(workspaceRoot, 'libs/auth/src/index.ts'),
			'@momentumcms/storage': resolve(workspaceRoot, 'libs/storage/src/index.ts'),
			'@momentumcms/logger': resolve(workspaceRoot, 'libs/logger/src/index.ts'),
			'@momentumcms/plugins/core': resolve(workspaceRoot, 'libs/plugins/core/src/index.ts'),
		},
	},
});
