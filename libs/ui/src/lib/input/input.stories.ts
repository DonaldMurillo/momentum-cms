import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Input } from './input.component';

const meta: Meta<Input> = {
	title: 'Components/Form/Input',
	component: Input,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Input],
		}),
	],
	argTypes: {
		type: {
			control: 'select',
			options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
			description: 'The type of input',
		},
		placeholder: {
			control: 'text',
			description: 'Placeholder text',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the input is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Input>;

export const Default: Story = {
	args: {
		type: 'text',
		placeholder: 'Enter text...',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-input [type]="type" [placeholder]="placeholder" />`,
	}),
};

export const Email: Story = {
	args: {
		type: 'email',
		placeholder: 'Enter email...',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-input [type]="type" [placeholder]="placeholder" />`,
	}),
};

export const Password: Story = {
	args: {
		type: 'password',
		placeholder: 'Enter password...',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-input [type]="type" [placeholder]="placeholder" />`,
	}),
};

export const Number: Story = {
	args: {
		type: 'number',
		placeholder: 'Enter number...',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-input [type]="type" [placeholder]="placeholder" />`,
	}),
};

export const Search: Story = {
	args: {
		type: 'search',
		placeholder: 'Search...',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-input [type]="type" [placeholder]="placeholder" />`,
	}),
};

export const Disabled: Story = {
	args: {
		type: 'text',
		placeholder: 'Disabled input',
		disabled: true,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-input [type]="type" [placeholder]="placeholder" [disabled]="disabled" />`,
	}),
};

export const WithValue: Story = {
	render: () => ({
		template: `<mcms-input type="text" value="Pre-filled value" />`,
	}),
};

export const AllTypes: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 300px;">
				<mcms-input type="text" placeholder="Text input" />
				<mcms-input type="email" placeholder="Email input" />
				<mcms-input type="password" placeholder="Password input" />
				<mcms-input type="number" placeholder="Number input" />
				<mcms-input type="tel" placeholder="Phone input" />
				<mcms-input type="url" placeholder="URL input" />
				<mcms-input type="search" placeholder="Search input" />
			</div>
		`,
	}),
};
