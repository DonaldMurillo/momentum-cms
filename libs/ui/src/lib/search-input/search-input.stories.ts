import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { expect, userEvent, within } from 'storybook/test';
import { SearchInput } from './search-input.component';

const meta: Meta<SearchInput> = {
	title: 'Components/Form/SearchInput',
	component: SearchInput,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [SearchInput],
		}),
	],
	argTypes: {
		placeholder: {
			control: 'text',
			description: 'Placeholder text',
		},
		debounce: {
			control: 'number',
			description: 'Debounce time in milliseconds',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the input is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<SearchInput>;

export const Default: Story = {
	render: () => ({
		props: {
			value: '',
			onSearch: (query: string) => {
				 
				console.log('Search:', query);
			},
		},
		template: `
			<mcms-search-input
				[(value)]="value"
				(searchChange)="onSearch($event)"
			/>
		`,
	}),
};

export const WithPlaceholder: Story = {
	render: () => ({
		props: {
			value: '',
			onSearch: (query: string) => {
				 
				console.log('Search:', query);
			},
		},
		template: `
			<mcms-search-input
				[(value)]="value"
				placeholder="Search users by name or email..."
				(searchChange)="onSearch($event)"
			/>
		`,
	}),
};

export const WithValue: Story = {
	render: () => ({
		props: {
			value: 'Current search',
			onClear: () => {
				 
				console.log('Cleared');
			},
		},
		template: `
			<mcms-search-input
				[(value)]="value"
				(clear)="onClear()"
			/>
		`,
	}),
};

export const CustomDebounce: Story = {
	render: () => ({
		props: {
			value: '',
			onSearch: (query: string) => {
				 
				console.log('Search:', query);
			},
		},
		template: `
			<div class="space-y-2">
				<mcms-search-input
					[(value)]="value"
					[debounce]="1000"
					placeholder="1 second debounce..."
					(searchChange)="onSearch($event)"
				/>
				<p class="text-sm text-muted-foreground">
					Search emits 1 second after you stop typing
				</p>
			</div>
		`,
	}),
};

export const Disabled: Story = {
	render: () => ({
		props: {
			value: 'Cannot edit',
		},
		template: `
			<mcms-search-input
				[(value)]="value"
				[disabled]="true"
			/>
		`,
	}),
};

// Interaction test: Type and clear
export const TypeAndClearInteraction: Story = {
	render: () => ({
		props: {
			value: '',
		},
		template: `
			<div>
				<mcms-search-input
					[(value)]="value"
					[debounce]="100"
					data-testid="search-input"
				/>
			</div>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Find the search input
		const input = canvas.getByPlaceholderText(/search/i);
		await expect(input).toBeVisible();

		// Type into the input
		await userEvent.type(input, 'test query');

		// Verify the input has the value
		await expect(input).toHaveValue('test query');

		// Wait for debounce
		await new Promise((resolve) => setTimeout(resolve, 200));

		// Find and click the clear button (it should appear when there's a value)
		const clearButton = canvas.getByRole('button', { name: /clear/i });
		await expect(clearButton).toBeVisible();

		// Click clear
		await userEvent.click(clearButton);

		// Verify input is cleared
		await expect(input).toHaveValue('');
	},
};

// Interaction test: Focus and Escape
export const KeyboardInteraction: Story = {
	render: () => ({
		props: {
			value: 'initial value',
		},
		template: `
			<mcms-search-input
				[(value)]="value"
				data-testid="keyboard-search"
			/>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Find the search input
		const input = canvas.getByPlaceholderText(/search/i);
		await expect(input).toBeVisible();

		// Focus the input
		await userEvent.click(input);

		// Press Escape to clear
		await userEvent.keyboard('{Escape}');

		// Verify input is cleared
		await expect(input).toHaveValue('');
	},
};
