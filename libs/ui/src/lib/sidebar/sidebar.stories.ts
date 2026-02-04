import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { expect, userEvent, within } from 'storybook/test';
import { provideRouter } from '@angular/router';
import { Sidebar } from './sidebar.component';
import { SidebarHeader } from './sidebar-header.component';
import { SidebarContent } from './sidebar-content.component';
import { SidebarFooter } from './sidebar-footer.component';
import { SidebarNav } from './sidebar-nav.component';
import { SidebarNavItem } from './sidebar-nav-item.component';
import { SidebarSection } from './sidebar-section.component';
import { Avatar } from '../avatar/avatar.component';
import { AvatarFallback } from '../avatar/avatar-fallback.component';
import { Button } from '../button/button.component';

const meta: Meta<Sidebar> = {
	title: 'Components/Navigation/Sidebar',
	component: Sidebar,
	tags: ['autodocs'],
	decorators: [
		applicationConfig({
			providers: [provideRouter([])],
		}),
		moduleMetadata({
			imports: [
				Sidebar,
				SidebarHeader,
				SidebarContent,
				SidebarFooter,
				SidebarNav,
				SidebarNavItem,
				SidebarSection,
				Avatar,
				AvatarFallback,
				Button,
			],
		}),
	],
	argTypes: {
		width: {
			control: 'text',
			description: 'Width of the sidebar when expanded',
		},
		collapsedWidth: {
			control: 'text',
			description: 'Width of the sidebar when collapsed',
		},
		collapsed: {
			control: 'boolean',
			description: 'Whether the sidebar is collapsed',
		},
	},
	parameters: {
		layout: 'fullscreen',
	},
};
export default meta;
type Story = StoryObj<Sidebar>;

const homeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`;
const usersIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const fileIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
const settingsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
const bellIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`;

export const Default: Story = {
	render: () => ({
		template: `
			<div style="height: 600px; display: flex;">
				<mcms-sidebar>
					<mcms-sidebar-header>
						<h1 class="text-lg font-semibold">My App</h1>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" [active]="true" />
							<mcms-sidebar-nav-item label="Users" href="/users" [icon]="usersIcon" />
							<mcms-sidebar-nav-item label="Documents" href="/documents" [icon]="fileIcon" />
							<mcms-sidebar-nav-item label="Settings" href="/settings" [icon]="settingsIcon" />
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
					<mcms-sidebar-footer>
						<div class="flex items-center gap-3 px-2">
							<mcms-avatar size="sm">
								<mcms-avatar-fallback [delayMs]="0">JD</mcms-avatar-fallback>
							</mcms-avatar>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium truncate">John Doe</p>
								<p class="text-xs text-muted-foreground truncate">john@example.com</p>
							</div>
						</div>
					</mcms-sidebar-footer>
				</mcms-sidebar>
				<div class="flex-1 p-8 bg-background">
					<h2 class="text-2xl font-bold">Main Content</h2>
					<p class="text-muted-foreground">The sidebar is on the left.</p>
				</div>
			</div>
		`,
		props: { homeIcon, usersIcon, fileIcon, settingsIcon },
	}),
};

export const WithSections: Story = {
	render: () => ({
		template: `
			<div style="height: 600px; display: flex;">
				<mcms-sidebar>
					<mcms-sidebar-header>
						<h1 class="text-lg font-semibold">Admin Panel</h1>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" [active]="true" />

							<mcms-sidebar-section title="Content">
								<mcms-sidebar-nav-item label="Posts" href="/posts" [icon]="fileIcon" />
								<mcms-sidebar-nav-item label="Media" href="/media" [icon]="fileIcon" />
								<mcms-sidebar-nav-item label="Categories" href="/categories" [icon]="fileIcon" />
							</mcms-sidebar-section>

							<mcms-sidebar-section title="Users" [collapsible]="true">
								<mcms-sidebar-nav-item label="All Users" href="/users" [icon]="usersIcon" />
								<mcms-sidebar-nav-item label="Roles" href="/roles" [icon]="usersIcon" />
								<mcms-sidebar-nav-item label="Permissions" href="/permissions" [icon]="usersIcon" />
							</mcms-sidebar-section>

							<mcms-sidebar-section title="Settings" [collapsible]="true">
								<mcms-sidebar-nav-item label="General" href="/settings/general" [icon]="settingsIcon" />
								<mcms-sidebar-nav-item label="Security" href="/settings/security" [icon]="settingsIcon" />
								<mcms-sidebar-nav-item label="API" href="/settings/api" [icon]="settingsIcon" />
							</mcms-sidebar-section>
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
					<mcms-sidebar-footer>
						<button mcms-button variant="ghost" class="w-full justify-start gap-3">
							<mcms-avatar size="sm">
								<mcms-avatar-fallback [delayMs]="0">AD</mcms-avatar-fallback>
							</mcms-avatar>
							<span>Admin User</span>
						</button>
					</mcms-sidebar-footer>
				</mcms-sidebar>
				<div class="flex-1 p-8 bg-background">
					<h2 class="text-2xl font-bold">Content Area</h2>
				</div>
			</div>
		`,
		props: { homeIcon, usersIcon, fileIcon, settingsIcon },
	}),
};

export const WithBadges: Story = {
	render: () => ({
		template: `
			<div style="height: 600px; display: flex;">
				<mcms-sidebar>
					<mcms-sidebar-header>
						<h1 class="text-lg font-semibold">Notifications</h1>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" />
							<mcms-sidebar-nav-item label="Notifications" href="/notifications" [icon]="bellIcon" [badge]="12" />
							<mcms-sidebar-nav-item label="Messages" href="/messages" [icon]="fileIcon" [badge]="3" />
							<mcms-sidebar-nav-item label="Tasks" href="/tasks" [icon]="fileIcon" badge="New" />
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
				</mcms-sidebar>
				<div class="flex-1 p-8 bg-background">
					<h2 class="text-2xl font-bold">Badges Example</h2>
					<p class="text-muted-foreground">Nav items can display badges for counts or status.</p>
				</div>
			</div>
		`,
		props: { homeIcon, bellIcon, fileIcon },
	}),
};

export const Collapsed: Story = {
	args: {
		collapsed: true,
	},
	render: (args) => ({
		props: { ...args, homeIcon, usersIcon, fileIcon, settingsIcon },
		template: `
			<div style="height: 600px; display: flex;">
				<mcms-sidebar [collapsed]="collapsed">
					<mcms-sidebar-header>
						<span class="text-xl font-bold">M</span>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" />
							<mcms-sidebar-nav-item label="Users" href="/users" [icon]="usersIcon" />
							<mcms-sidebar-nav-item label="Documents" href="/documents" [icon]="fileIcon" />
							<mcms-sidebar-nav-item label="Settings" href="/settings" [icon]="settingsIcon" />
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
				</mcms-sidebar>
				<div class="flex-1 p-8 bg-background">
					<h2 class="text-2xl font-bold">Collapsed Sidebar</h2>
					<p class="text-muted-foreground">The sidebar is collapsed to show only icons.</p>
				</div>
			</div>
		`,
	}),
};

export const CustomWidth: Story = {
	args: {
		width: '20rem',
	},
	render: (args) => ({
		props: { ...args, homeIcon, usersIcon, fileIcon, settingsIcon },
		template: `
			<div style="height: 600px; display: flex;">
				<mcms-sidebar [width]="width">
					<mcms-sidebar-header>
						<h1 class="text-lg font-semibold">Wide Sidebar</h1>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" />
							<mcms-sidebar-nav-item label="Users" href="/users" [icon]="usersIcon" />
							<mcms-sidebar-nav-item label="Documents" href="/documents" [icon]="fileIcon" />
							<mcms-sidebar-nav-item label="Settings" href="/settings" [icon]="settingsIcon" />
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
				</mcms-sidebar>
				<div class="flex-1 p-8 bg-background">
					<h2 class="text-2xl font-bold">Custom Width</h2>
					<p class="text-muted-foreground">This sidebar is 20rem wide instead of the default 16rem.</p>
				</div>
			</div>
		`,
	}),
};

export const DisabledItems: Story = {
	render: () => ({
		template: `
			<div style="height: 600px; display: flex;">
				<mcms-sidebar>
					<mcms-sidebar-header>
						<h1 class="text-lg font-semibold">App</h1>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" [active]="true" />
							<mcms-sidebar-nav-item label="Users" href="/users" [icon]="usersIcon" />
							<mcms-sidebar-nav-item label="Premium Feature" href="/premium" [icon]="fileIcon" [disabled]="true" />
							<mcms-sidebar-nav-item label="Settings" href="/settings" [icon]="settingsIcon" />
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
				</mcms-sidebar>
				<div class="flex-1 p-8 bg-background">
					<h2 class="text-2xl font-bold">Disabled Items</h2>
					<p class="text-muted-foreground">Some nav items can be disabled.</p>
				</div>
			</div>
		`,
		props: { homeIcon, usersIcon, fileIcon, settingsIcon },
	}),
};

// Interaction test: Navigation items visibility and accessibility
export const NavigationInteraction: Story = {
	render: () => ({
		template: `
			<div style="height: 400px; display: flex;" data-testid="nav-test">
				<mcms-sidebar>
					<mcms-sidebar-header>
						<h1 class="text-lg font-semibold">Test App</h1>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" data-testid="nav-dashboard" />
							<mcms-sidebar-nav-item label="Users" href="/users" [icon]="usersIcon" data-testid="nav-users" />
							<mcms-sidebar-nav-item label="Settings" href="/settings" [icon]="settingsIcon" data-testid="nav-settings" />
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
				</mcms-sidebar>
			</div>
		`,
		props: { homeIcon, usersIcon, settingsIcon },
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Verify navigation role is present
		const nav = canvas.getByRole('navigation');
		await expect(nav).toBeVisible();

		// Verify all nav items are visible
		await expect(canvas.getByText('Dashboard')).toBeVisible();
		await expect(canvas.getByText('Users')).toBeVisible();
		await expect(canvas.getByText('Settings')).toBeVisible();

		// Verify links are present
		const links = canvas.getAllByRole('link');
		await expect(links.length).toBeGreaterThanOrEqual(3);
	},
};

// Interaction test: Collapsible sections
export const SectionCollapseInteraction: Story = {
	render: () => ({
		template: `
			<div style="height: 500px; display: flex;" data-testid="section-test">
				<mcms-sidebar>
					<mcms-sidebar-header>
						<h1 class="text-lg font-semibold">Sections</h1>
					</mcms-sidebar-header>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-section title="Main" [collapsible]="false">
								<mcms-sidebar-nav-item label="Home" href="/" [icon]="homeIcon" />
							</mcms-sidebar-section>
							<mcms-sidebar-section title="Settings" [collapsible]="true" [(expanded)]="expanded" data-testid="collapsible-section">
								<mcms-sidebar-nav-item label="Profile" href="/profile" [icon]="usersIcon" />
								<mcms-sidebar-nav-item label="Security" href="/security" [icon]="settingsIcon" />
							</mcms-sidebar-section>
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
				</mcms-sidebar>
			</div>
		`,
		props: { homeIcon, usersIcon, settingsIcon, expanded: true },
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Verify section titles are visible
		await expect(canvas.getByText('Main')).toBeVisible();
		await expect(canvas.getByText('Settings')).toBeVisible();

		// Verify items in expanded section are visible
		await expect(canvas.getByText('Profile')).toBeVisible();
		await expect(canvas.getByText('Security')).toBeVisible();

		// Find the collapse button (for Settings section)
		const collapseButton = canvas.getByRole('button', { name: /settings/i });
		await expect(collapseButton).toBeVisible();
		await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

		// Click to collapse
		await userEvent.click(collapseButton);

		// Wait for animation
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Button should now show collapsed state
		await expect(collapseButton).toHaveAttribute('aria-expanded', 'false');
	},
};

// Interaction test: Active state and hover
export const ActiveStateInteraction: Story = {
	render: () => ({
		template: `
			<div style="height: 400px; display: flex;" data-testid="active-test">
				<mcms-sidebar>
					<mcms-sidebar-content>
						<mcms-sidebar-nav>
							<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" [icon]="homeIcon" [active]="true" data-testid="active-item" />
							<mcms-sidebar-nav-item label="Users" href="/users" [icon]="usersIcon" data-testid="inactive-item" />
						</mcms-sidebar-nav>
					</mcms-sidebar-content>
				</mcms-sidebar>
			</div>
		`,
		props: { homeIcon, usersIcon },
	}),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Verify Dashboard (active) is visible
		const dashboardLink = canvas.getByText('Dashboard');
		await expect(dashboardLink).toBeVisible();

		// Verify Users (inactive) is visible
		const usersLink = canvas.getByText('Users');
		await expect(usersLink).toBeVisible();

		// Hover over Users to trigger hover state
		await userEvent.hover(usersLink);

		// Wait for transition
		await new Promise((resolve) => setTimeout(resolve, 100));
	},
};
