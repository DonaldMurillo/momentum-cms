const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');
const adminPreset = require('../../libs/admin/tailwind.preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
	presets: [adminPreset],
	content: [
		join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
		// Explicitly include library components
		join(__dirname, '../../libs/admin/src/**/*.{ts,html}'),
		join(__dirname, '../../libs/ui/src/**/*.{ts,html}'),
		...createGlobPatternsForDependencies(__dirname),
	],
	// Safelist critical UI classes that might not be detected in component templates
	safelist: [
		// Input classes
		'px-3',
		'py-2',
		'h-10',
		'rounded-md',
		'border',
		'border-input',
		'bg-background',
		'text-sm',
		'text-foreground',
		// Card classes
		'rounded-lg',
		'border-border',
		'bg-card',
		'text-card-foreground',
		'shadow-sm',
		// Layout
		'flex',
		'w-full',
		'space-y-2',
		'space-y-4',
		'p-6',
		'pt-0',
	],
	theme: {
		extend: {},
	},
	plugins: [],
};
