import type { Config } from 'tailwindcss';
import { createGlobPatternsForDependencies } from '@nx/angular/tailwind';
import { join } from 'node:path';

const adminPreset = require('../../libs/admin/tailwind.preset');

export default {
	presets: [adminPreset],
	content: [
		join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html,md,analog,ag}'),
		// Explicitly include admin library components
		join(__dirname, '../../libs/admin/src/**/*.{ts,html}'),
		...createGlobPatternsForDependencies(__dirname),
	],
	theme: {
		extend: {},
	},
	plugins: [],
} satisfies Config;
