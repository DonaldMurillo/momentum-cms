import type { Config } from 'tailwindcss';

const adminPreset = require('@momentumcms/admin/tailwind.preset');

export default {
	presets: [adminPreset],
	content: [
		'./src/**/*.{html,ts,analog,ag}',
		'./node_modules/@momentumcms/admin/**/*.{html,ts,mjs}',
		'./node_modules/@momentumcms/ui/**/*.{html,ts,mjs}',
	],
} satisfies Config;
