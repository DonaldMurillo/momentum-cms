import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Pagination } from './pagination.component';

const meta: Meta<Pagination> = {
	title: 'Components/Navigation/Pagination',
	component: Pagination,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Pagination],
		}),
	],
	argTypes: {
		currentPage: {
			control: 'number',
			description: 'Current active page (1-indexed)',
		},
		totalPages: {
			control: 'number',
			description: 'Total number of pages',
		},
		siblingCount: {
			control: 'number',
			description: 'Number of siblings on each side of current page',
		},
	},
};
export default meta;
type Story = StoryObj<Pagination>;

export const Default: Story = {
	args: {
		currentPage: 1,
		totalPages: 10,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-pagination [currentPage]="currentPage" [totalPages]="totalPages" />
		`,
	}),
};

export const MiddlePage: Story = {
	args: {
		currentPage: 5,
		totalPages: 10,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-pagination [currentPage]="currentPage" [totalPages]="totalPages" />
		`,
	}),
};

export const LastPage: Story = {
	args: {
		currentPage: 10,
		totalPages: 10,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-pagination [currentPage]="currentPage" [totalPages]="totalPages" />
		`,
	}),
};

export const FewPages: Story = {
	args: {
		currentPage: 2,
		totalPages: 3,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-pagination [currentPage]="currentPage" [totalPages]="totalPages" />
		`,
	}),
};

export const ManyPages: Story = {
	args: {
		currentPage: 15,
		totalPages: 100,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-pagination [currentPage]="currentPage" [totalPages]="totalPages" />
		`,
	}),
};

export const WithSiblings: Story = {
	args: {
		currentPage: 10,
		totalPages: 20,
		siblingCount: 2,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-pagination [currentPage]="currentPage" [totalPages]="totalPages" [siblingCount]="siblingCount" />
		`,
	}),
};

export const SinglePage: Story = {
	args: {
		currentPage: 1,
		totalPages: 1,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-pagination [currentPage]="currentPage" [totalPages]="totalPages" />
		`,
	}),
};
