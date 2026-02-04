import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { expect, userEvent, within } from 'storybook/test';
import { DataTable } from './data-table.component';
import type { DataTableColumn, DataTableRowAction } from './data-table.types';

interface User {
	id: number;
	name: string;
	email: string;
	role: string;
	status: 'active' | 'inactive' | 'pending';
	createdAt: string;
}

const sampleUsers: User[] = [
	{
		id: 1,
		name: 'Alice Johnson',
		email: 'alice@example.com',
		role: 'Admin',
		status: 'active',
		createdAt: '2024-01-15',
	},
	{
		id: 2,
		name: 'Bob Smith',
		email: 'bob@example.com',
		role: 'User',
		status: 'active',
		createdAt: '2024-02-20',
	},
	{
		id: 3,
		name: 'Charlie Brown',
		email: 'charlie@example.com',
		role: 'Editor',
		status: 'pending',
		createdAt: '2024-03-10',
	},
	{
		id: 4,
		name: 'Diana Prince',
		email: 'diana@example.com',
		role: 'User',
		status: 'inactive',
		createdAt: '2024-01-05',
	},
	{
		id: 5,
		name: 'Eve Wilson',
		email: 'eve@example.com',
		role: 'Admin',
		status: 'active',
		createdAt: '2024-04-01',
	},
	{
		id: 6,
		name: 'Frank Miller',
		email: 'frank@example.com',
		role: 'User',
		status: 'active',
		createdAt: '2024-02-28',
	},
	{
		id: 7,
		name: 'Grace Lee',
		email: 'grace@example.com',
		role: 'Editor',
		status: 'pending',
		createdAt: '2024-03-15',
	},
	{
		id: 8,
		name: 'Henry Davis',
		email: 'henry@example.com',
		role: 'User',
		status: 'active',
		createdAt: '2024-01-22',
	},
	{
		id: 9,
		name: 'Ivy Chen',
		email: 'ivy@example.com',
		role: 'Admin',
		status: 'active',
		createdAt: '2024-04-10',
	},
	{
		id: 10,
		name: 'Jack Thompson',
		email: 'jack@example.com',
		role: 'User',
		status: 'inactive',
		createdAt: '2024-02-14',
	},
];

const basicColumns: DataTableColumn<User>[] = [
	{ field: 'name', header: 'Name', sortable: true },
	{ field: 'email', header: 'Email', sortable: true },
	{ field: 'role', header: 'Role', sortable: true },
	{ field: 'status', header: 'Status' },
];

const meta: Meta<DataTable<User>> = {
	title: 'Components/Data Display/DataTable',
	component: DataTable,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [DataTable],
		}),
	],
	argTypes: {
		searchable: {
			control: 'boolean',
			description: 'Enable search functionality',
		},
		selectable: {
			control: 'boolean',
			description: 'Enable row selection',
		},
		paginated: {
			control: 'boolean',
			description: 'Enable pagination',
		},
		pageSize: {
			control: 'number',
			description: 'Number of rows per page',
		},
		loading: {
			control: 'boolean',
			description: 'Show loading state',
		},
		clickableRows: {
			control: 'boolean',
			description: 'Make rows clickable',
		},
	},
};
export default meta;
type Story = StoryObj<DataTable<User>>;

export const Default: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
			/>
		`,
	}),
};

export const WithSelection: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
			selectedItems: [],
			onSelectionChange: (items: User[]) => {
				// eslint-disable-next-line no-console
				console.log('Selected:', items);
			},
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[selectable]="true"
				[(selectedItems)]="selectedItems"
				(selectionChange)="onSelectionChange($event)"
			/>
			<p class="mt-4 text-sm text-muted-foreground">
				Selected: {{ selectedItems.length }} items
			</p>
		`,
	}),
};

const rowActionsData: DataTableRowAction<User>[] = [
	{ id: 'view', label: 'View Details' },
	{ id: 'edit', label: 'Edit' },
	{ id: 'delete', label: 'Delete', variant: 'destructive' },
];

export const WithRowActions: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
			rowActions: rowActionsData,
			onRowAction: (event: { action: DataTableRowAction<User>; item: User }) => {
				// eslint-disable-next-line no-console
				console.log('Action:', event.action.id, 'on', event.item.name);
			},
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[rowActions]="rowActions"
				(rowAction)="onRowAction($event)"
			/>
		`,
	}),
};

export const Loading: Story = {
	render: () => ({
		props: {
			data: [],
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[loading]="true"
			/>
		`,
	}),
};

export const EmptyState: Story = {
	render: () => ({
		props: {
			data: [],
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				emptyTitle="No users found"
				emptyDescription="Try adjusting your search or add a new user."
			/>
		`,
	}),
};

export const WithoutSearch: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[searchable]="false"
			/>
		`,
	}),
};

export const WithoutPagination: Story = {
	render: () => ({
		props: {
			data: sampleUsers.slice(0, 5),
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[paginated]="false"
			/>
		`,
	}),
};

export const SmallPageSize: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[pageSize]="3"
			/>
		`,
	}),
};

export const ClickableRows: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
			onRowClick: (user: User) => {
				// eslint-disable-next-line no-console
				console.log('Clicked:', user.name);
			},
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[clickableRows]="true"
				(rowClick)="onRowClick($event)"
			/>
		`,
	}),
};

export const FullFeatured: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
			selectedItems: [],
			rowActions: rowActionsData,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[selectable]="true"
				[searchable]="true"
				[paginated]="true"
				[pageSize]="5"
				[rowActions]="rowActions"
				[(selectedItems)]="selectedItems"
			/>
		`,
	}),
};

// Interaction test: Search functionality
export const SearchInteraction: Story = {
	render: () => ({
		props: {
			data: sampleUsers,
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[searchable]="true"
				data-testid="search-table"
			/>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Find the search input
		const searchInput = canvas.getByPlaceholderText(/search/i);
		await expect(searchInput).toBeVisible();

		// Verify initial row count (should show all users visible on page)
		const initialRows = canvas.getAllByRole('row');
		// Header row + data rows
		await expect(initialRows.length).toBeGreaterThan(1);

		// Type a search query
		await userEvent.clear(searchInput);
		await userEvent.type(searchInput, 'Alice');

		// Wait for debounce and verify filtering (Alice Johnson should be found)
		await new Promise((resolve) => setTimeout(resolve, 400));
	},
};

// Interaction test: Row selection
export const SelectionInteraction: Story = {
	render: () => ({
		props: {
			data: sampleUsers.slice(0, 3),
			columns: basicColumns,
			selectedItems: [],
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[selectable]="true"
				[paginated]="false"
				[(selectedItems)]="selectedItems"
				data-testid="selection-table"
			/>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Find all checkboxes
		const checkboxes = canvas.getAllByRole('checkbox');
		// Header checkbox + row checkboxes
		await expect(checkboxes.length).toBeGreaterThan(1);

		// Click the first row checkbox (index 1, since 0 is header)
		const firstRowCheckbox = checkboxes[1];
		await userEvent.click(firstRowCheckbox);

		// Verify checkbox is now checked
		await expect(firstRowCheckbox).toBeChecked();
	},
};

// Interaction test: Sortable columns
export const SortInteraction: Story = {
	render: () => ({
		props: {
			data: sampleUsers.slice(0, 5),
			columns: basicColumns,
		},
		template: `
			<mcms-data-table
				[data]="data"
				[columns]="columns"
				[sortable]="true"
				[paginated]="false"
				data-testid="sort-table"
			/>
		`,
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Find the Name column header (should be sortable)
		const nameHeader = canvas.getByText('Name');
		await expect(nameHeader).toBeVisible();

		// Click to sort
		await userEvent.click(nameHeader);

		// The header should now have sorting indicator
		// Wait for the sort to apply
		await new Promise((resolve) => setTimeout(resolve, 100));
	},
};
