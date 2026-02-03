import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Table } from './table.component';
import { TableHeader } from './table-header.component';
import { TableBody } from './table-body.component';
import { TableFooter } from './table-footer.component';
import { TableRow } from './table-row.component';
import { TableHead } from './table-head.component';
import { TableCell } from './table-cell.component';
import { TableCaption } from './table-caption.component';
import { Badge } from '../badge/badge.component';
import { Avatar } from '../avatar/avatar.component';
import { AvatarFallback } from '../avatar/avatar-fallback.component';
import { Button } from '../button/button.component';

const meta: Meta<Table> = {
	title: 'Components/Data/Table',
	component: Table,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [
				Table,
				TableHeader,
				TableBody,
				TableFooter,
				TableRow,
				TableHead,
				TableCell,
				TableCaption,
				Badge,
				Avatar,
				AvatarFallback,
				Button,
			],
		}),
	],
	argTypes: {
		enableSelection: {
			control: 'boolean',
			description: 'Whether selection is enabled',
		},
		multi: {
			control: 'boolean',
			description: 'Whether multiple cells can be selected',
		},
	},
};
export default meta;
type Story = StoryObj<Table>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-table>
				<mcms-table-header>
					<mcms-table-row>
						<mcms-table-head>Invoice</mcms-table-head>
						<mcms-table-head>Status</mcms-table-head>
						<mcms-table-head>Method</mcms-table-head>
						<mcms-table-head style="text-align: right;">Amount</mcms-table-head>
					</mcms-table-row>
				</mcms-table-header>
				<mcms-table-body>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV001</mcms-table-cell>
						<mcms-table-cell>Paid</mcms-table-cell>
						<mcms-table-cell>Credit Card</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$250.00</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV002</mcms-table-cell>
						<mcms-table-cell>Pending</mcms-table-cell>
						<mcms-table-cell>PayPal</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$150.00</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV003</mcms-table-cell>
						<mcms-table-cell>Unpaid</mcms-table-cell>
						<mcms-table-cell>Bank Transfer</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$350.00</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-body>
			</mcms-table>
		`,
	}),
};

export const WithCaption: Story = {
	render: () => ({
		template: `
			<mcms-table>
				<mcms-table-caption>A list of your recent invoices.</mcms-table-caption>
				<mcms-table-header>
					<mcms-table-row>
						<mcms-table-head>Invoice</mcms-table-head>
						<mcms-table-head>Status</mcms-table-head>
						<mcms-table-head>Method</mcms-table-head>
						<mcms-table-head style="text-align: right;">Amount</mcms-table-head>
					</mcms-table-row>
				</mcms-table-header>
				<mcms-table-body>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV001</mcms-table-cell>
						<mcms-table-cell>Paid</mcms-table-cell>
						<mcms-table-cell>Credit Card</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$250.00</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV002</mcms-table-cell>
						<mcms-table-cell>Pending</mcms-table-cell>
						<mcms-table-cell>PayPal</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$150.00</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-body>
			</mcms-table>
		`,
	}),
};

export const WithFooter: Story = {
	render: () => ({
		template: `
			<mcms-table>
				<mcms-table-header>
					<mcms-table-row>
						<mcms-table-head>Invoice</mcms-table-head>
						<mcms-table-head>Status</mcms-table-head>
						<mcms-table-head>Method</mcms-table-head>
						<mcms-table-head style="text-align: right;">Amount</mcms-table-head>
					</mcms-table-row>
				</mcms-table-header>
				<mcms-table-body>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV001</mcms-table-cell>
						<mcms-table-cell>Paid</mcms-table-cell>
						<mcms-table-cell>Credit Card</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$250.00</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV002</mcms-table-cell>
						<mcms-table-cell>Paid</mcms-table-cell>
						<mcms-table-cell>PayPal</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$150.00</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">INV003</mcms-table-cell>
						<mcms-table-cell>Paid</mcms-table-cell>
						<mcms-table-cell>Bank Transfer</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$350.00</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-body>
				<mcms-table-footer>
					<mcms-table-row>
						<mcms-table-cell colspan="3">Total</mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$750.00</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-footer>
			</mcms-table>
		`,
	}),
};

export const WithStatusBadges: Story = {
	render: () => ({
		template: `
			<mcms-table>
				<mcms-table-header>
					<mcms-table-row>
						<mcms-table-head>Order</mcms-table-head>
						<mcms-table-head>Customer</mcms-table-head>
						<mcms-table-head>Status</mcms-table-head>
						<mcms-table-head style="text-align: right;">Total</mcms-table-head>
					</mcms-table-row>
				</mcms-table-header>
				<mcms-table-body>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">#3210</mcms-table-cell>
						<mcms-table-cell>Olivia Martin</mcms-table-cell>
						<mcms-table-cell><mcms-badge variant="success">Completed</mcms-badge></mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$42.25</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">#3209</mcms-table-cell>
						<mcms-table-cell>Ava Johnson</mcms-table-cell>
						<mcms-table-cell><mcms-badge variant="warning">Processing</mcms-badge></mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$74.99</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">#3208</mcms-table-cell>
						<mcms-table-cell>Michael Brown</mcms-table-cell>
						<mcms-table-cell><mcms-badge variant="destructive">Cancelled</mcms-badge></mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$64.75</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell style="font-weight: 500;">#3207</mcms-table-cell>
						<mcms-table-cell>Isabella Davis</mcms-table-cell>
						<mcms-table-cell><mcms-badge variant="default">Pending</mcms-badge></mcms-table-cell>
						<mcms-table-cell style="text-align: right;">$89.99</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-body>
			</mcms-table>
		`,
	}),
};

export const WithAvatars: Story = {
	render: () => ({
		template: `
			<mcms-table>
				<mcms-table-header>
					<mcms-table-row>
						<mcms-table-head>Member</mcms-table-head>
						<mcms-table-head>Role</mcms-table-head>
						<mcms-table-head>Status</mcms-table-head>
						<mcms-table-head style="text-align: right;">Actions</mcms-table-head>
					</mcms-table-row>
				</mcms-table-header>
				<mcms-table-body>
					<mcms-table-row>
						<mcms-table-cell>
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<mcms-avatar size="sm">
									<mcms-avatar-fallback>JD</mcms-avatar-fallback>
								</mcms-avatar>
								<div>
									<div style="font-weight: 500;">John Doe</div>
									<div style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">john@example.com</div>
								</div>
							</div>
						</mcms-table-cell>
						<mcms-table-cell>Admin</mcms-table-cell>
						<mcms-table-cell><mcms-badge variant="success">Active</mcms-badge></mcms-table-cell>
						<mcms-table-cell style="text-align: right;">
							<button mcms-button variant="ghost" size="sm">Edit</button>
						</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell>
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<mcms-avatar size="sm">
									<mcms-avatar-fallback>JS</mcms-avatar-fallback>
								</mcms-avatar>
								<div>
									<div style="font-weight: 500;">Jane Smith</div>
									<div style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">jane@example.com</div>
								</div>
							</div>
						</mcms-table-cell>
						<mcms-table-cell>Editor</mcms-table-cell>
						<mcms-table-cell><mcms-badge variant="success">Active</mcms-badge></mcms-table-cell>
						<mcms-table-cell style="text-align: right;">
							<button mcms-button variant="ghost" size="sm">Edit</button>
						</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell>
							<div style="display: flex; align-items: center; gap: 0.75rem;">
								<mcms-avatar size="sm">
									<mcms-avatar-fallback>RJ</mcms-avatar-fallback>
								</mcms-avatar>
								<div>
									<div style="font-weight: 500;">Robert Johnson</div>
									<div style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">robert@example.com</div>
								</div>
							</div>
						</mcms-table-cell>
						<mcms-table-cell>Viewer</mcms-table-cell>
						<mcms-table-cell><mcms-badge variant="secondary">Invited</mcms-badge></mcms-table-cell>
						<mcms-table-cell style="text-align: right;">
							<button mcms-button variant="ghost" size="sm">Edit</button>
						</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-body>
			</mcms-table>
		`,
	}),
};

export const Simple: Story = {
	render: () => ({
		template: `
			<mcms-table>
				<mcms-table-header>
					<mcms-table-row>
						<mcms-table-head>Name</mcms-table-head>
						<mcms-table-head>Email</mcms-table-head>
					</mcms-table-row>
				</mcms-table-header>
				<mcms-table-body>
					<mcms-table-row>
						<mcms-table-cell>John Doe</mcms-table-cell>
						<mcms-table-cell>john@example.com</mcms-table-cell>
					</mcms-table-row>
					<mcms-table-row>
						<mcms-table-cell>Jane Smith</mcms-table-cell>
						<mcms-table-cell>jane@example.com</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-body>
			</mcms-table>
		`,
	}),
};

export const Empty: Story = {
	render: () => ({
		template: `
			<mcms-table>
				<mcms-table-header>
					<mcms-table-row>
						<mcms-table-head>Name</mcms-table-head>
						<mcms-table-head>Email</mcms-table-head>
						<mcms-table-head>Role</mcms-table-head>
					</mcms-table-row>
				</mcms-table-header>
				<mcms-table-body>
					<mcms-table-row>
						<mcms-table-cell colspan="3" style="text-align: center; padding: 2rem; color: hsl(var(--mcms-muted-foreground));">
							No users found.
						</mcms-table-cell>
					</mcms-table-row>
				</mcms-table-body>
			</mcms-table>
		`,
	}),
};
