const adminPreset = require('@momentum-cms/admin/tailwind.preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
	presets: [adminPreset],
	content: [
		'./src/**/*.{html,ts}',
		'./node_modules/@momentum-cms/admin/**/*.{html,ts,mjs}',
		'./node_modules/@momentum-cms/ui/**/*.{html,ts,mjs}',
	],
};
