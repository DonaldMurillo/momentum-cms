import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Select } from './select.component';

const meta: Meta<Select> = {
	title: 'Components/Form/Select',
	component: Select,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Select],
		}),
	],
	argTypes: {
		placeholder: {
			control: 'text',
			description: 'Placeholder text',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the select is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Select>;

const defaultOptions = [
	{ value: 'apple', label: 'Apple' },
	{ value: 'banana', label: 'Banana' },
	{ value: 'cherry', label: 'Cherry' },
	{ value: 'date', label: 'Date' },
];

export const Default: Story = {
	render: () => ({
		props: { options: defaultOptions },
		template: `<mcms-select [options]="options" placeholder="Select a fruit" />`,
	}),
};

export const WithValue: Story = {
	render: () => ({
		props: { options: defaultOptions },
		template: `<mcms-select [options]="options" value="banana" />`,
	}),
};

export const Disabled: Story = {
	render: () => ({
		props: { options: defaultOptions },
		template: `<mcms-select [options]="options" placeholder="Disabled select" [disabled]="true" />`,
	}),
};

export const WithDisabledOption: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'apple', label: 'Apple' },
				{ value: 'banana', label: 'Banana', disabled: true },
				{ value: 'cherry', label: 'Cherry' },
			],
		},
		template: `<mcms-select [options]="options" placeholder="Select a fruit" />`,
	}),
};

export const StatusSelect: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'draft', label: 'Draft' },
				{ value: 'pending', label: 'Pending Review' },
				{ value: 'published', label: 'Published' },
				{ value: 'archived', label: 'Archived' },
			],
		},
		template: `<mcms-select [options]="options" placeholder="Select status" />`,
	}),
};

export const CountrySelect: Story = {
	render: () => ({
		props: {
			options: [
				{ value: 'us', label: 'United States' },
				{ value: 'uk', label: 'United Kingdom' },
				{ value: 'ca', label: 'Canada' },
				{ value: 'au', label: 'Australia' },
				{ value: 'de', label: 'Germany' },
				{ value: 'fr', label: 'France' },
			],
		},
		template: `<mcms-select [options]="options" placeholder="Select country" />`,
	}),
};

export const Multiple: Story = {
	render: () => ({
		props: {
			fruits: defaultOptions,
			statuses: [
				{ value: 'active', label: 'Active' },
				{ value: 'inactive', label: 'Inactive' },
			],
		},
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 300px;">
				<mcms-select [options]="fruits" placeholder="Select fruit" />
				<mcms-select [options]="statuses" placeholder="Select status" />
				<mcms-select [options]="fruits" [disabled]="true" placeholder="Disabled" />
			</div>
		`,
	}),
};
