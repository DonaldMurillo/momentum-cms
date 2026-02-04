import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Checkbox } from './checkbox.component';

const meta: Meta<Checkbox> = {
	title: 'Components/Form/Checkbox',
	component: Checkbox,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Checkbox],
		}),
	],
	argTypes: {
		disabled: {
			control: 'boolean',
			description: 'Whether the checkbox is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Checkbox>;

export const Default: Story = {
	render: () => ({
		template: `<mcms-checkbox>Accept terms and conditions</mcms-checkbox>`,
	}),
};

export const Checked: Story = {
	render: () => ({
		template: `<mcms-checkbox [value]="true">Checked by default</mcms-checkbox>`,
	}),
};

export const Disabled: Story = {
	render: () => ({
		template: `<mcms-checkbox [disabled]="true">Disabled checkbox</mcms-checkbox>`,
	}),
};

export const DisabledChecked: Story = {
	render: () => ({
		template: `<mcms-checkbox [value]="true" [disabled]="true">Disabled and checked</mcms-checkbox>`,
	}),
};

export const Multiple: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 0.75rem;">
				<mcms-checkbox>Option 1</mcms-checkbox>
				<mcms-checkbox [value]="true">Option 2 (checked)</mcms-checkbox>
				<mcms-checkbox>Option 3</mcms-checkbox>
				<mcms-checkbox [disabled]="true">Option 4 (disabled)</mcms-checkbox>
			</div>
		`,
	}),
};

export const WithLongLabel: Story = {
	render: () => ({
		template: `
			<div style="max-width: 300px;">
				<mcms-checkbox>
					I agree to the terms of service, privacy policy, and all other legal agreements associated with this product
				</mcms-checkbox>
			</div>
		`,
	}),
};
