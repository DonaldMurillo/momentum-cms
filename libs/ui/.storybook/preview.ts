import type { Preview } from '@storybook/angular';

const preview: Preview = {
	parameters: {
		backgrounds: {
			options: {
				light: { name: 'light', value: 'hsl(0 0% 100%)' },
				dark: { name: 'dark', value: 'hsl(222 47% 11%)' },
			},
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
	globalTypes: {
		theme: {
			description: 'Theme for components',
			toolbar: {
				title: 'Theme',
				icon: 'circlehollow',
				items: ['light', 'dark'],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: {
		backgrounds: {
			value: 'light',
		},
	},
};

export default preview;
