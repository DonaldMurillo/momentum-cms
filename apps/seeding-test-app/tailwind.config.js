const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');
const adminPreset = require(join(__dirname, '../../libs/admin/tailwind.preset'));

/** @type {import('tailwindcss').Config} */
module.exports = {
	presets: [adminPreset],
	content: [
		join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
		join(__dirname, '../../libs/admin/src/**/*.{ts,html}'),
		...createGlobPatternsForDependencies(__dirname),
	],
	theme: {
		extend: {},
	},
	plugins: [],
};
