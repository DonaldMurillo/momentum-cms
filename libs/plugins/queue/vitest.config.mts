import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
	root: __dirname,
	cacheDir: '../../../node_modules/.vite/libs/plugins/queue',
	plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
	test: {
		name: 'plugins-queue',
		watch: false,
		globals: true,
		environment: 'node',
		include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
		coverage: {
			reportsDirectory: '../../../coverage/libs/plugins/queue',
			provider: 'v8' as const,
		},
	},
}));
