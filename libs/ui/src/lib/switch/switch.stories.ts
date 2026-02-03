import type { Meta, StoryObj } from '@storybook/angular';
import { Switch } from './switch.component';

const meta: Meta<Switch> = {
	title: 'Components/Form/Switch',
	component: Switch,
	tags: ['autodocs'],
	argTypes: {
		disabled: {
			control: 'boolean',
			description: 'Whether the switch is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Switch>;

export const Default: Story = {
	render: () => ({
		template: `<mcms-switch>Enable notifications</mcms-switch>`,
	}),
};

export const Checked: Story = {
	render: () => ({
		template: `<mcms-switch [value]="true">Feature enabled</mcms-switch>`,
	}),
};

export const Disabled: Story = {
	render: () => ({
		template: `<mcms-switch [disabled]="true">Disabled switch</mcms-switch>`,
	}),
};

export const DisabledChecked: Story = {
	render: () => ({
		template: `<mcms-switch [value]="true" [disabled]="true">Disabled and on</mcms-switch>`,
	}),
};

export const Multiple: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem;">
				<mcms-switch>Email notifications</mcms-switch>
				<mcms-switch [value]="true">Push notifications</mcms-switch>
				<mcms-switch>SMS notifications</mcms-switch>
				<mcms-switch [disabled]="true">Marketing emails (disabled)</mcms-switch>
			</div>
		`,
	}),
};

export const Settings: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 400px;">
				<div style="display: flex; justify-content: space-between; align-items: center;">
					<div>
						<div style="font-weight: 500;">Dark Mode</div>
						<div style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground));">Use dark theme</div>
					</div>
					<mcms-switch [value]="true"></mcms-switch>
				</div>
				<div style="display: flex; justify-content: space-between; align-items: center;">
					<div>
						<div style="font-weight: 500;">Auto-save</div>
						<div style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground));">Automatically save changes</div>
					</div>
					<mcms-switch></mcms-switch>
				</div>
				<div style="display: flex; justify-content: space-between; align-items: center;">
					<div>
						<div style="font-weight: 500;">Analytics</div>
						<div style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground));">Share usage data</div>
					</div>
					<mcms-switch></mcms-switch>
				</div>
			</div>
		`,
	}),
};
