import type { Config } from 'tailwindcss';

const adminPreset = require('@momentum-cms/admin/tailwind.preset');

export default {
	presets: [adminPreset],
	content: [
		'./src/**/*.{html,ts,analog,ag}',
		'./node_modules/@momentum-cms/admin/**/*.{html,ts,mjs}',
		'./node_modules/@momentum-cms/ui/**/*.{html,ts,mjs}',
	],
} satisfies Config;
