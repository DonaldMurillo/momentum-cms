import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { McmsFormField } from './form-field.component';
import { Label } from '../label/label.component';
import { Input } from '../input/input.component';
import { Textarea } from '../textarea/textarea.component';
import { Select } from '../select/select.component';
import { Button } from '../button/button.component';

const meta: Meta<McmsFormField> = {
	title: 'Components/Form/McmsFormField',
	component: McmsFormField,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [McmsFormField, Label, Input, Textarea, Select, Button],
		}),
	],
	argTypes: {
		required: {
			control: 'boolean',
			description: 'Whether the field is required',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the field is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<McmsFormField>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-form-field id="email">
				<span mcmsLabel>Email</span>
				<mcms-input type="email" placeholder="Enter your email" />
			</mcms-form-field>
		`,
	}),
};

export const Required: Story = {
	render: () => ({
		template: `
			<mcms-form-field id="username" [required]="true">
				<span mcmsLabel>Username</span>
				<mcms-input placeholder="Enter username" />
			</mcms-form-field>
		`,
	}),
};

export const WithHint: Story = {
	render: () => ({
		template: `
			<mcms-form-field id="bio" hint="This will be your public display name.">
				<span mcmsLabel>Bio</span>
				<mcms-input placeholder="Enter bio" />
			</mcms-form-field>
		`,
	}),
};

export const WithError: Story = {
	render: () => ({
		props: {
			errors: [{ kind: 'minLength', message: 'Password must be at least 8 characters.' }],
		},
		template: `
			<mcms-form-field id="password" [errors]="errors">
				<span mcmsLabel>Password</span>
				<mcms-input type="password" placeholder="Enter password" />
			</mcms-form-field>
		`,
	}),
};

export const Disabled: Story = {
	render: () => ({
		template: `
			<mcms-form-field id="locked" [disabled]="true">
				<span mcmsLabel>Locked Field</span>
				<mcms-input placeholder="Cannot edit" />
			</mcms-form-field>
		`,
	}),
};

export const WithTextarea: Story = {
	render: () => ({
		template: `
			<mcms-form-field id="description" hint="You can use up to 500 characters.">
				<span mcmsLabel>Description</span>
				<mcms-textarea placeholder="Tell us about yourself" rows="4"></mcms-textarea>
			</mcms-form-field>
		`,
	}),
};

export const CompleteForm: Story = {
	render: () => ({
		props: {
			roleOptions: [
				{ value: 'admin', label: 'Admin' },
				{ value: 'editor', label: 'Editor' },
				{ value: 'viewer', label: 'Viewer' },
			],
		},
		template: `
			<div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 400px;">
				<mcms-form-field id="name" [required]="true">
					<span mcmsLabel>Full Name</span>
					<mcms-input placeholder="John Doe" />
				</mcms-form-field>

				<mcms-form-field id="email" [required]="true" hint="We'll send a confirmation email.">
					<span mcmsLabel>Email</span>
					<mcms-input type="email" placeholder="john@example.com" />
				</mcms-form-field>

				<mcms-form-field id="role">
					<span mcmsLabel>Role</span>
					<mcms-select [options]="roleOptions" placeholder="Select role" />
				</mcms-form-field>

				<mcms-form-field id="bio">
					<span mcmsLabel>Bio</span>
					<mcms-textarea placeholder="Tell us about yourself" rows="3"></mcms-textarea>
				</mcms-form-field>

				<button mcms-button variant="primary" style="align-self: flex-start;">Submit</button>
			</div>
		`,
	}),
};
