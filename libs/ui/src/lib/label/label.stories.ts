import type { Meta, StoryObj } from '@storybook/angular';
import { Label } from './label.component';

const meta: Meta<Label> = {
	title: 'Components/Form/Label',
	component: Label,
	tags: ['autodocs'],
	argTypes: {
		for: {
			control: 'text',
			description: 'The id of the form element this label is for',
		},
	},
};
export default meta;
type Story = StoryObj<Label>;

export const Default: Story = {
	render: () => ({
		template: `<mcms-label>Email address</mcms-label>`,
	}),
};

export const WithInput: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 0.5rem;">
				<mcms-label for="email-input">Email address</mcms-label>
				<mcms-input id="email-input" type="email" placeholder="Enter your email" />
			</div>
		`,
	}),
};

export const Required: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 0.5rem;">
				<mcms-label for="name-input">
					Full Name <span style="color: hsl(var(--mcms-destructive));">*</span>
				</mcms-label>
				<mcms-input id="name-input" placeholder="Enter your name" />
			</div>
		`,
	}),
};

export const WithCheckbox: Story = {
	render: () => ({
		template: `
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<mcms-checkbox id="terms" />
				<mcms-label for="terms">Accept terms and conditions</mcms-label>
			</div>
		`,
	}),
};

export const Multiple: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 300px;">
				<div style="display: flex; flex-direction: column; gap: 0.5rem;">
					<mcms-label for="first-name">First Name</mcms-label>
					<mcms-input id="first-name" placeholder="John" />
				</div>
				<div style="display: flex; flex-direction: column; gap: 0.5rem;">
					<mcms-label for="last-name">Last Name</mcms-label>
					<mcms-input id="last-name" placeholder="Doe" />
				</div>
				<div style="display: flex; flex-direction: column; gap: 0.5rem;">
					<mcms-label for="email">Email</mcms-label>
					<mcms-input id="email" type="email" placeholder="john@example.com" />
				</div>
			</div>
		`,
	}),
};
