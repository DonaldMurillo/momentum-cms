import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
	root: __dirname,
	cacheDir: '../../node_modules/.vite/libs/storage',
	plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
	test: {
		name: 'storage',
		watch: false,
		globals: true,
		environment: 'node',
		include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		reporters: ['default'],
		coverage: {
			reportsDirectory: '../../coverage/libs/storage',
			provider: 'v8' as const,
		},
	},
}));
