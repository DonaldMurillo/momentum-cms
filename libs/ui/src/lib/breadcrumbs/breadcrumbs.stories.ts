import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Breadcrumbs } from './breadcrumbs.component';
import { BreadcrumbItem } from './breadcrumb-item.component';
import { BreadcrumbSeparator } from './breadcrumb-separator.component';

const meta: Meta<Breadcrumbs> = {
	title: 'Components/Navigation/Breadcrumbs',
	component: Breadcrumbs,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Breadcrumbs, BreadcrumbItem, BreadcrumbSeparator],
		}),
	],
};
export default meta;
type Story = StoryObj<Breadcrumbs>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-breadcrumbs>
				<mcms-breadcrumb-item href="/">Home</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item href="/products">Products</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item [current]="true">Details</mcms-breadcrumb-item>
			</mcms-breadcrumbs>
		`,
	}),
};

export const TwoLevels: Story = {
	render: () => ({
		template: `
			<mcms-breadcrumbs>
				<mcms-breadcrumb-item href="/">Home</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item [current]="true">Dashboard</mcms-breadcrumb-item>
			</mcms-breadcrumbs>
		`,
	}),
};

export const ManyLevels: Story = {
	render: () => ({
		template: `
			<mcms-breadcrumbs>
				<mcms-breadcrumb-item href="/">Home</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item href="/documents">Documents</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item href="/documents/projects">Projects</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item href="/documents/projects/2024">2024</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item [current]="true">Q1 Report</mcms-breadcrumb-item>
			</mcms-breadcrumbs>
		`,
	}),
};

export const WithIcons: Story = {
	render: () => ({
		template: `
			<mcms-breadcrumbs>
				<mcms-breadcrumb-item href="/">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
						<polyline points="9 22 9 12 15 12 15 22"/>
					</svg>
				</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item href="/settings">Settings</mcms-breadcrumb-item>
				<mcms-breadcrumb-separator />
				<mcms-breadcrumb-item [current]="true">Profile</mcms-breadcrumb-item>
			</mcms-breadcrumbs>
		`,
	}),
};

export const SingleItem: Story = {
	render: () => ({
		template: `
			<mcms-breadcrumbs>
				<mcms-breadcrumb-item [current]="true">Home</mcms-breadcrumb-item>
			</mcms-breadcrumbs>
		`,
	}),
};
