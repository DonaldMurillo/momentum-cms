import type { Meta, StoryObj } from '@storybook/angular';
import { Badge } from './badge.component';

const meta: Meta<Badge> = {
	title: 'Components/Badge',
	component: Badge,
	tags: ['autodocs'],
	argTypes: {
		variant: {
			control: 'select',
			options: ['default', 'secondary', 'destructive', 'outline', 'success', 'warning'],
			description: 'The visual style variant of the badge',
		},
	},
};
export default meta;
type Story = StoryObj<Badge>;

export const Default: Story = {
	args: {
		variant: 'default',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-badge [variant]="variant">Badge</mcms-badge>`,
	}),
};

export const Secondary: Story = {
	args: {
		variant: 'secondary',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-badge [variant]="variant">Secondary</mcms-badge>`,
	}),
};

export const Destructive: Story = {
	args: {
		variant: 'destructive',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-badge [variant]="variant">Error</mcms-badge>`,
	}),
};

export const Outline: Story = {
	args: {
		variant: 'outline',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-badge [variant]="variant">Outline</mcms-badge>`,
	}),
};

export const Success: Story = {
	args: {
		variant: 'success',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-badge [variant]="variant">Active</mcms-badge>`,
	}),
};

export const Warning: Story = {
	args: {
		variant: 'warning',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-badge [variant]="variant">Pending</mcms-badge>`,
	}),
};

export const AllVariants: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
				<mcms-badge variant="default">Default</mcms-badge>
				<mcms-badge variant="secondary">Secondary</mcms-badge>
				<mcms-badge variant="destructive">Destructive</mcms-badge>
				<mcms-badge variant="outline">Outline</mcms-badge>
				<mcms-badge variant="success">Success</mcms-badge>
				<mcms-badge variant="warning">Warning</mcms-badge>
			</div>
		`,
	}),
};

export const WithNumbers: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
				<mcms-badge>5</mcms-badge>
				<mcms-badge variant="destructive">99+</mcms-badge>
				<mcms-badge variant="success">12</mcms-badge>
			</div>
		`,
	}),
};
