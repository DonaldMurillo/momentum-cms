import type { Meta, StoryObj } from '@storybook/angular';
import { Spinner } from './spinner.component';

const meta: Meta<Spinner> = {
	title: 'Components/Spinner',
	component: Spinner,
	tags: ['autodocs'],
	argTypes: {
		size: {
			control: 'select',
			options: ['sm', 'md', 'lg'],
			description: 'The size of the spinner',
		},
		label: {
			control: 'text',
			description: 'Accessible label for screen readers',
		},
	},
};
export default meta;
type Story = StoryObj<Spinner>;

export const Default: Story = {
	args: {
		size: 'md',
		label: 'Loading',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-spinner [size]="size" [label]="label" />`,
	}),
};

export const Small: Story = {
	args: {
		size: 'sm',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-spinner [size]="size" />`,
	}),
};

export const Medium: Story = {
	args: {
		size: 'md',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-spinner [size]="size" />`,
	}),
};

export const Large: Story = {
	args: {
		size: 'lg',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-spinner [size]="size" />`,
	}),
};

export const AllSizes: Story = {
	render: () => ({
		template: `
			<div style="display: flex; gap: 1.5rem; align-items: center;">
				<mcms-spinner size="sm" />
				<mcms-spinner size="md" />
				<mcms-spinner size="lg" />
			</div>
		`,
	}),
};

export const WithButton: Story = {
	render: () => ({
		template: `
			<button mcms-button disabled>
				<mcms-spinner size="sm" />
				Loading...
			</button>
		`,
	}),
};
