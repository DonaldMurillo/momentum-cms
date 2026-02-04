import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { FieldDisplay } from './field-display.component';

const meta: Meta<FieldDisplay> = {
	title: 'Components/Data Display/FieldDisplay',
	component: FieldDisplay,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [FieldDisplay],
		}),
	],
	argTypes: {
		type: {
			control: 'select',
			options: [
				'text',
				'number',
				'date',
				'datetime',
				'boolean',
				'badge',
				'link',
				'email',
				'list',
				'json',
			],
			description: 'Display type',
		},
		emptyText: {
			control: 'text',
			description: 'Text shown when value is empty',
		},
	},
};
export default meta;
type Story = StoryObj<FieldDisplay>;

export const Text: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="'John Doe'"
				type="text"
				label="Name"
			/>
		`,
	}),
};

export const Number: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="1234567.89"
				type="number"
				label="Amount"
			/>
		`,
	}),
};

export const Date: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="'2024-06-15'"
				type="date"
				label="Created Date"
			/>
		`,
	}),
};

export const DateTime: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="'2024-06-15T14:30:00'"
				type="datetime"
				label="Last Updated"
			/>
		`,
	}),
};

export const BooleanTrue: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="true"
				type="boolean"
				label="Active"
			/>
		`,
	}),
};

export const BooleanFalse: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="false"
				type="boolean"
				label="Verified"
			/>
		`,
	}),
};

export const Badge: Story = {
	render: () => ({
		template: `
			<div class="space-y-4">
				<mcms-field-display [value]="'active'" type="badge" label="Status" />
				<mcms-field-display [value]="'pending'" type="badge" label="Status" />
				<mcms-field-display [value]="'error'" type="badge" label="Status" />
			</div>
		`,
	}),
};

export const Link: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="'https://example.com'"
				type="link"
				label="Website"
			/>
		`,
	}),
};

export const Email: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="'contact@example.com'"
				type="email"
				label="Contact"
			/>
		`,
	}),
};

export const List: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="['JavaScript', 'TypeScript', 'Angular', 'React']"
				type="list"
				label="Skills"
			/>
		`,
	}),
};

export const ListTruncated: Story = {
	render: () => ({
		template: `
			<mcms-field-display
				[value]="['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6', 'Item 7']"
				type="list"
				label="Items"
				[maxItems]="3"
			/>
		`,
	}),
};

export const Json: Story = {
	render: () => ({
		props: {
			data: {
				name: 'John',
				age: 30,
				roles: ['admin', 'user'],
				settings: { theme: 'dark' },
			},
		},
		template: `
			<mcms-field-display
				[value]="data"
				type="json"
				label="Configuration"
			/>
		`,
	}),
};

export const EmptyValue: Story = {
	render: () => ({
		template: `
			<div class="space-y-4">
				<mcms-field-display [value]="null" type="text" label="Null Value" />
				<mcms-field-display [value]="''" type="text" label="Empty String" />
				<mcms-field-display [value]="undefined" type="text" label="Undefined" emptyText="N/A" />
			</div>
		`,
	}),
};

export const AllTypes: Story = {
	render: () => ({
		props: {
			jsonData: { key: 'value', nested: { prop: 123 } },
		},
		template: `
			<div class="grid grid-cols-2 gap-4">
				<mcms-field-display [value]="'John Doe'" type="text" label="Text" />
				<mcms-field-display [value]="42500" type="number" label="Number" />
				<mcms-field-display [value]="'2024-01-15'" type="date" label="Date" />
				<mcms-field-display [value]="'2024-01-15T09:30:00'" type="datetime" label="DateTime" />
				<mcms-field-display [value]="true" type="boolean" label="Boolean" />
				<mcms-field-display [value]="'active'" type="badge" label="Badge" />
				<mcms-field-display [value]="'https://angular.dev'" type="link" label="Link" />
				<mcms-field-display [value]="'hello@world.com'" type="email" label="Email" />
				<mcms-field-display [value]="['A', 'B', 'C']" type="list" label="List" />
				<mcms-field-display [value]="jsonData" type="json" label="JSON" />
			</div>
		`,
	}),
};

// Interaction test: Verify all field types render correctly
export const FieldTypesInteraction: Story = {
	render: () => ({
		props: {
			jsonData: { test: 'value' },
		},
		template: `
			<div class="space-y-4" data-testid="field-types-container">
				<mcms-field-display [value]="'Test Text'" type="text" label="Text Field" data-testid="text-field" />
				<mcms-field-display [value]="12345" type="number" label="Number Field" data-testid="number-field" />
				<mcms-field-display [value]="true" type="boolean" label="Boolean True" data-testid="boolean-true" />
				<mcms-field-display [value]="false" type="boolean" label="Boolean False" data-testid="boolean-false" />
				<mcms-field-display [value]="'https://example.com'" type="link" label="Link Field" data-testid="link-field" />
				<mcms-field-display [value]="'test@example.com'" type="email" label="Email Field" data-testid="email-field" />
			</div>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Verify text field displays value
		await expect(canvas.getByText('Test Text')).toBeVisible();

		// Verify number field displays formatted value
		await expect(canvas.getByText('12,345')).toBeVisible();

		// Verify boolean fields show Yes/No indicators
		await expect(canvas.getByText('Yes')).toBeVisible();
		await expect(canvas.getByText('No')).toBeVisible();

		// Verify link is clickable (use exact text to avoid matching email)
		const link = canvas.getByRole('link', { name: 'https://example.com' });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', 'https://example.com');

		// Verify email link (use exact text)
		const emailLink = canvas.getByRole('link', { name: 'test@example.com' });
		await expect(emailLink).toBeVisible();
		await expect(emailLink).toHaveAttribute('href', 'mailto:test@example.com');
	},
};

// Interaction test: Empty state rendering
export const EmptyStateInteraction: Story = {
	render: () => ({
		template: `
			<div class="space-y-4" data-testid="empty-container">
				<mcms-field-display [value]="null" type="text" label="Null Value" emptyText="No data" />
				<mcms-field-display [value]="''" type="text" label="Empty String" emptyText="Empty" />
			</div>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Verify empty text is shown for null/empty values
		await expect(canvas.getByText('No data')).toBeVisible();
		await expect(canvas.getByText('Empty')).toBeVisible();
	},
};
