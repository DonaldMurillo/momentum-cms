const adminPreset = require('@momentumcms/admin/tailwind.preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
	presets: [adminPreset],
	content: [
		'./src/**/*.{html,ts}',
		'./node_modules/@momentumcms/admin/**/*.{html,ts,mjs}',
		'./node_modules/@momentumcms/ui/**/*.{html,ts,mjs}',
	],
};
