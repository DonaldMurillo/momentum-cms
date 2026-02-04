import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Progress } from './progress.component';

const meta: Meta<Progress> = {
	title: 'Components/Progress',
	component: Progress,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Progress],
		}),
	],
	argTypes: {
		value: {
			control: { type: 'range', min: 0, max: 100, step: 1 },
			description: 'Current progress value (null for indeterminate)',
		},
		max: {
			control: { type: 'number', min: 1 },
			description: 'Maximum value',
		},
	},
};
export default meta;
type Story = StoryObj<Progress>;

export const Default: Story = {
	args: {
		value: 50,
		max: 100,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-progress [value]="value" [max]="max" />`,
	}),
};

export const Empty: Story = {
	args: {
		value: 0,
		max: 100,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-progress [value]="value" [max]="max" />`,
	}),
};

export const Quarter: Story = {
	args: {
		value: 25,
		max: 100,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-progress [value]="value" [max]="max" />`,
	}),
};

export const Half: Story = {
	args: {
		value: 50,
		max: 100,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-progress [value]="value" [max]="max" />`,
	}),
};

export const ThreeQuarters: Story = {
	args: {
		value: 75,
		max: 100,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-progress [value]="value" [max]="max" />`,
	}),
};

export const Complete: Story = {
	args: {
		value: 100,
		max: 100,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-progress [value]="value" [max]="max" />`,
	}),
};

export const Indeterminate: Story = {
	args: {
		value: null,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-progress [value]="value" />`,
	}),
};

export const CustomMax: Story = {
	args: {
		value: 3,
		max: 10,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="display: flex; flex-direction: column; gap: 0.5rem;">
				<span style="font-size: 0.875rem;">3 of 10 steps</span>
				<mcms-progress [value]="value" [max]="max" />
			</div>
		`,
	}),
};

export const Multiple: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1.5rem; width: 300px;">
				<div>
					<span style="font-size: 0.875rem; display: block; margin-bottom: 0.5rem;">Storage: 25%</span>
					<mcms-progress [value]="25" />
				</div>
				<div>
					<span style="font-size: 0.875rem; display: block; margin-bottom: 0.5rem;">Upload: 66%</span>
					<mcms-progress [value]="66" />
				</div>
				<div>
					<span style="font-size: 0.875rem; display: block; margin-bottom: 0.5rem;">Download: 90%</span>
					<mcms-progress [value]="90" />
				</div>
			</div>
		`,
	}),
};
