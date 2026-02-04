import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Alert } from './alert.component';
import { AlertTitle } from './alert-title.component';
import { AlertDescription } from './alert-description.component';

const meta: Meta<Alert> = {
	title: 'Components/Layout/Alert',
	component: Alert,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Alert, AlertTitle, AlertDescription],
		}),
	],
	argTypes: {
		variant: {
			control: 'select',
			options: ['default', 'destructive', 'success', 'warning', 'info'],
			description: 'The visual style variant of the alert',
		},
	},
};
export default meta;
type Story = StoryObj<Alert>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-alert>
				<mcms-alert-title>Heads up!</mcms-alert-title>
				<mcms-alert-description>
					You can add components to your app using the CLI.
				</mcms-alert-description>
			</mcms-alert>
		`,
	}),
};

export const Destructive: Story = {
	render: () => ({
		template: `
			<mcms-alert variant="destructive">
				<mcms-alert-title>Error</mcms-alert-title>
				<mcms-alert-description>
					Your session has expired. Please log in again.
				</mcms-alert-description>
			</mcms-alert>
		`,
	}),
};

export const Success: Story = {
	render: () => ({
		template: `
			<mcms-alert variant="success">
				<mcms-alert-title>Success</mcms-alert-title>
				<mcms-alert-description>
					Your changes have been saved successfully.
				</mcms-alert-description>
			</mcms-alert>
		`,
	}),
};

export const Warning: Story = {
	render: () => ({
		template: `
			<mcms-alert variant="warning">
				<mcms-alert-title>Warning</mcms-alert-title>
				<mcms-alert-description>
					Your subscription will expire in 7 days.
				</mcms-alert-description>
			</mcms-alert>
		`,
	}),
};

export const Info: Story = {
	render: () => ({
		template: `
			<mcms-alert variant="info">
				<mcms-alert-title>Information</mcms-alert-title>
				<mcms-alert-description>
					A new version of this application is available.
				</mcms-alert-description>
			</mcms-alert>
		`,
	}),
};

export const AllVariants: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
				<mcms-alert>
					<mcms-alert-title>Default</mcms-alert-title>
					<mcms-alert-description>This is a default alert message.</mcms-alert-description>
				</mcms-alert>
				<mcms-alert variant="destructive">
					<mcms-alert-title>Destructive</mcms-alert-title>
					<mcms-alert-description>This is a destructive alert message.</mcms-alert-description>
				</mcms-alert>
				<mcms-alert variant="success">
					<mcms-alert-title>Success</mcms-alert-title>
					<mcms-alert-description>This is a success alert message.</mcms-alert-description>
				</mcms-alert>
				<mcms-alert variant="warning">
					<mcms-alert-title>Warning</mcms-alert-title>
					<mcms-alert-description>This is a warning alert message.</mcms-alert-description>
				</mcms-alert>
				<mcms-alert variant="info">
					<mcms-alert-title>Info</mcms-alert-title>
					<mcms-alert-description>This is an info alert message.</mcms-alert-description>
				</mcms-alert>
			</div>
		`,
	}),
};

export const TitleOnly: Story = {
	render: () => ({
		template: `
			<mcms-alert variant="info">
				<mcms-alert-title>Quick tip: Use keyboard shortcuts to navigate faster!</mcms-alert-title>
			</mcms-alert>
		`,
	}),
};

export const LongContent: Story = {
	render: () => ({
		template: `
			<mcms-alert variant="warning" style="max-width: 500px;">
				<mcms-alert-title>Action Required</mcms-alert-title>
				<mcms-alert-description>
					Your password is scheduled to expire in 5 days. We recommend updating it now to avoid
					any interruption to your access. You can change your password in Settings > Security >
					Change Password. If you need assistance, please contact support.
				</mcms-alert-description>
			</mcms-alert>
		`,
	}),
};
