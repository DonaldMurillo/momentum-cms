import type { Meta, StoryObj } from '@storybook/angular';
import { EmptyState } from './empty-state.component';

const meta: Meta<EmptyState> = {
	title: 'Components/Layout/EmptyState',
	component: EmptyState,
	tags: ['autodocs'],
	argTypes: {
		size: {
			control: 'select',
			options: ['sm', 'md', 'lg'],
			description: 'The size of the empty state',
		},
		title: {
			control: 'text',
			description: 'The title text',
		},
		description: {
			control: 'text',
			description: 'The description text',
		},
	},
};
export default meta;
type Story = StoryObj<EmptyState>;

export const Default: Story = {
	args: {
		title: 'No results found',
		description: 'Try adjusting your search or filter to find what you are looking for.',
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-empty-state [title]="title" [description]="description">
				<svg mcms-empty-state-icon width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--mcms-muted-foreground));">
					<circle cx="11" cy="11" r="8"/>
					<path d="m21 21-4.3-4.3"/>
				</svg>
			</mcms-empty-state>
		`,
	}),
};

export const WithAction: Story = {
	render: () => ({
		template: `
			<mcms-empty-state title="No projects yet" description="Get started by creating your first project.">
				<svg mcms-empty-state-icon width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--mcms-muted-foreground));">
					<path d="M12 2v20M2 12h20"/>
				</svg>
				<button mcms-empty-state-action mcms-button variant="primary">Create Project</button>
			</mcms-empty-state>
		`,
	}),
};

export const NoData: Story = {
	render: () => ({
		template: `
			<mcms-empty-state title="No data available" description="Data will appear here once it's been added to the system.">
				<svg mcms-empty-state-icon width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--mcms-muted-foreground));">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
					<polyline points="7 10 12 15 17 10"/>
					<line x1="12" x2="12" y1="15" y2="3"/>
				</svg>
			</mcms-empty-state>
		`,
	}),
};

export const Small: Story = {
	args: {
		size: 'sm',
		title: 'No items',
		description: 'Add items to see them here.',
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="border: 1px dashed hsl(var(--mcms-border)); border-radius: 0.5rem;">
				<mcms-empty-state [size]="size" [title]="title" [description]="description">
					<svg mcms-empty-state-icon width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--mcms-muted-foreground));">
						<rect width="18" height="18" x="3" y="3" rx="2"/>
						<path d="M12 8v8"/>
						<path d="M8 12h8"/>
					</svg>
				</mcms-empty-state>
			</div>
		`,
	}),
};

export const Large: Story = {
	args: {
		size: 'lg',
		title: 'Welcome to the Dashboard',
		description:
			'This is your central hub for managing everything. Start by exploring the menu on the left.',
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-empty-state [size]="size" [title]="title" [description]="description">
				<svg mcms-empty-state-icon width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: hsl(var(--mcms-muted-foreground));">
					<rect width="7" height="9" x="3" y="3" rx="1"/>
					<rect width="7" height="5" x="14" y="3" rx="1"/>
					<rect width="7" height="9" x="14" y="12" rx="1"/>
					<rect width="7" height="5" x="3" y="16" rx="1"/>
				</svg>
				<button mcms-empty-state-action mcms-button variant="primary">Get Started</button>
			</mcms-empty-state>
		`,
	}),
};

export const AllSizes: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 2rem;">
				<div style="border: 1px dashed hsl(var(--mcms-border)); border-radius: 0.5rem;">
					<mcms-empty-state size="sm" title="Small" description="This is a small empty state.">
						<svg mcms-empty-state-icon width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: hsl(var(--mcms-muted-foreground));">
							<circle cx="12" cy="12" r="10"/>
						</svg>
					</mcms-empty-state>
				</div>
				<div style="border: 1px dashed hsl(var(--mcms-border)); border-radius: 0.5rem;">
					<mcms-empty-state size="md" title="Medium" description="This is a medium empty state.">
						<svg mcms-empty-state-icon width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: hsl(var(--mcms-muted-foreground));">
							<circle cx="12" cy="12" r="10"/>
						</svg>
					</mcms-empty-state>
				</div>
				<div style="border: 1px dashed hsl(var(--mcms-border)); border-radius: 0.5rem;">
					<mcms-empty-state size="lg" title="Large" description="This is a large empty state.">
						<svg mcms-empty-state-icon width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: hsl(var(--mcms-muted-foreground));">
							<circle cx="12" cy="12" r="10"/>
						</svg>
					</mcms-empty-state>
				</div>
			</div>
		`,
	}),
};
