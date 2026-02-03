import type { Meta, StoryObj } from '@storybook/angular';
import { RadioGroup } from './radio-group.component';

const meta: Meta<RadioGroup> = {
	title: 'Components/Form/RadioGroup',
	component: RadioGroup,
	tags: ['autodocs'],
	argTypes: {
		disabled: {
			control: 'boolean',
			description: 'Whether the radio group is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<RadioGroup>;

export const Default: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'option1', label: 'Option 1' },
				{ value: 'option2', label: 'Option 2' },
				{ value: 'option3', label: 'Option 3' },
			],
		},
		template: `
			<mcms-radio-group [options]="options" />
		`,
	}),
};

export const WithSelection: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'option1', label: 'Option 1' },
				{ value: 'option2', label: 'Option 2 (selected)' },
				{ value: 'option3', label: 'Option 3' },
			],
		},
		template: `
			<mcms-radio-group [options]="options" value="option2" />
		`,
	}),
};

export const Disabled: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'option1', label: 'Option 1' },
				{ value: 'option2', label: 'Option 2' },
				{ value: 'option3', label: 'Option 3' },
			],
		},
		template: `
			<mcms-radio-group [options]="options" [disabled]="true" />
		`,
	}),
};

export const DisabledItem: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'option1', label: 'Option 1' },
				{ value: 'option2', label: 'Option 2 (disabled)', disabled: true },
				{ value: 'option3', label: 'Option 3' },
			],
		},
		template: `
			<mcms-radio-group [options]="options" />
		`,
	}),
};

export const PaymentMethods: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'card', label: 'Credit/Debit Card' },
				{ value: 'paypal', label: 'PayPal' },
				{ value: 'bank', label: 'Bank Transfer' },
				{ value: 'crypto', label: 'Cryptocurrency (coming soon)', disabled: true },
			],
		},
		template: `
			<mcms-radio-group [options]="options" value="card" />
		`,
	}),
};

export const NotificationPreferences: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'all', label: 'All notifications' },
				{ value: 'important', label: 'Important only' },
				{ value: 'none', label: 'No notifications' },
			],
		},
		template: `
			<div style="max-width: 300px;">
				<h4 style="font-weight: 500; margin-bottom: 1rem;">Email Preferences</h4>
				<mcms-radio-group [options]="options" value="important" />
			</div>
		`,
	}),
};

export const PlanSelection: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'free', label: 'Free - $0/month' },
				{ value: 'pro', label: 'Pro - $9/month' },
				{ value: 'enterprise', label: 'Enterprise - $29/month' },
			],
		},
		template: `
			<div style="max-width: 300px;">
				<h4 style="font-weight: 500; margin-bottom: 1rem;">Select Plan</h4>
				<mcms-radio-group [options]="options" value="pro" />
			</div>
		`,
	}),
};
