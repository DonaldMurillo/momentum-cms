import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from './button.component';

const meta: Meta<Button> = {
	title: 'Components/Button',
	component: Button,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Button],
		}),
	],
	argTypes: {
		variant: {
			control: 'select',
			options: ['primary', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
			description: 'The visual style variant of the button',
		},
		size: {
			control: 'select',
			options: ['sm', 'md', 'lg', 'icon'],
			description: 'The size of the button',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the button is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Button>;

export const Primary: Story = {
	args: {
		variant: 'primary',
		size: 'md',
		disabled: false,
	},
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant" [size]="size" [disabled]="disabled">Primary Button</button>`,
	}),
};

export const Secondary: Story = {
	args: {
		variant: 'secondary',
		size: 'md',
	},
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant" [size]="size">Secondary Button</button>`,
	}),
};

export const Destructive: Story = {
	args: {
		variant: 'destructive',
		size: 'md',
	},
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant" [size]="size">Delete</button>`,
	}),
};

export const Outline: Story = {
	args: {
		variant: 'outline',
		size: 'md',
	},
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant" [size]="size">Outline</button>`,
	}),
};

export const Ghost: Story = {
	args: {
		variant: 'ghost',
		size: 'md',
	},
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant" [size]="size">Ghost</button>`,
	}),
};

export const Link: Story = {
	args: {
		variant: 'link',
		size: 'md',
	},
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant" [size]="size">Link</button>`,
	}),
};

export const Sizes: Story = {
	render: () => ({
		template: `
			<div style="display: flex; gap: 1rem; align-items: center;">
				<button mcms-button size="sm">Small</button>
				<button mcms-button size="md">Medium</button>
				<button mcms-button size="lg">Large</button>
				<button mcms-button size="icon">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M5 12h14"/>
						<path d="M12 5v14"/>
					</svg>
				</button>
			</div>
		`,
	}),
};

export const Disabled: Story = {
	args: {
		variant: 'primary',
		disabled: true,
	},
	render: (args) => ({
		props: args,
		template: `<button mcms-button [variant]="variant" [disabled]="disabled">Disabled Button</button>`,
	}),
};

export const AllVariants: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-wrap: wrap; gap: 1rem;">
				<button mcms-button variant="primary">Primary</button>
				<button mcms-button variant="secondary">Secondary</button>
				<button mcms-button variant="destructive">Destructive</button>
				<button mcms-button variant="outline">Outline</button>
				<button mcms-button variant="ghost">Ghost</button>
				<button mcms-button variant="link">Link</button>
			</div>
		`,
	}),
};

// Interaction test
export const ClickInteraction: Story = {
	args: {
		variant: 'primary',
		size: 'md',
	},
	render: (args) => ({
		props: { ...args, clicked: false },
		template: `
			<button mcms-button [variant]="variant" [size]="size" (click)="clicked = true" data-testid="click-button">
				{{ clicked ? 'Clicked!' : 'Click Me' }}
			</button>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByTestId('click-button');

		// Initial state
		await expect(button).toHaveTextContent('Click Me');

		// Click the button
		await userEvent.click(button);

		// After click
		await expect(button).toHaveTextContent('Clicked!');
	},
};
