import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Textarea } from './textarea.component';

const meta: Meta<Textarea> = {
	title: 'Components/Form/Textarea',
	component: Textarea,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Textarea],
		}),
	],
	argTypes: {
		placeholder: {
			control: 'text',
			description: 'Placeholder text',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the textarea is disabled',
		},
		rows: {
			control: 'number',
			description: 'Number of visible rows',
		},
	},
};
export default meta;
type Story = StoryObj<Textarea>;

export const Default: Story = {
	args: {
		placeholder: 'Enter your message...',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-textarea [placeholder]="placeholder" />`,
	}),
};

export const WithRows: Story = {
	args: {
		placeholder: 'Enter your message...',
		rows: 6,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-textarea [placeholder]="placeholder" [rows]="rows" />`,
	}),
};

export const Disabled: Story = {
	args: {
		placeholder: 'Disabled textarea',
		disabled: true,
	},
	render: (args) => ({
		props: args,
		template: `<mcms-textarea [placeholder]="placeholder" [disabled]="disabled" />`,
	}),
};

export const WithValue: Story = {
	render: () => ({
		template: `<mcms-textarea value="This textarea has some pre-filled content that spans multiple lines.\n\nYou can edit this text." />`,
	}),
};

export const Sizes: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 400px;">
				<mcms-textarea placeholder="Small (3 rows)" rows="3" />
				<mcms-textarea placeholder="Medium (5 rows)" rows="5" />
				<mcms-textarea placeholder="Large (8 rows)" rows="8" />
			</div>
		`,
	}),
};
