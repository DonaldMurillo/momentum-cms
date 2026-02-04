import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { CdkMenuModule } from '@angular/cdk/menu';
import { DropdownMenu } from './dropdown-menu.component';
import { DropdownMenuItem } from './dropdown-menu-item.component';
import { DropdownLabel } from './dropdown-label.component';
import { DropdownSeparator } from './dropdown-separator.component';
import { Button } from '../button/button.component';
import { Avatar } from '../avatar/avatar.component';
import { AvatarFallback } from '../avatar/avatar-fallback.component';

const meta: Meta<DropdownMenu> = {
	title: 'Components/Overlay/DropdownMenu',
	component: DropdownMenu,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [
				CdkMenuModule,
				DropdownMenu,
				DropdownMenuItem,
				DropdownLabel,
				DropdownSeparator,
				Button,
				Avatar,
				AvatarFallback,
			],
		}),
	],
	argTypes: {
		disabled: {
			control: 'boolean',
			description: 'Whether the menu is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<DropdownMenu>;

export const Default: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="menu">
					Open Menu
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 0.5rem;">
						<path d="m6 9 6 6 6-6"/>
					</svg>
				</button>
				<ng-template #menu>
					<mcms-dropdown-menu cdkMenu>
						<button mcms-dropdown-item cdkMenuItem value="profile">Profile</button>
						<button mcms-dropdown-item cdkMenuItem value="settings">Settings</button>
						<button mcms-dropdown-item cdkMenuItem value="billing">Billing</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="logout">Log out</button>
					</mcms-dropdown-menu>
				</ng-template>
			</div>
		`,
	}),
};

export const WithLabel: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="menu">Actions</button>
				<ng-template #menu>
					<mcms-dropdown-menu cdkMenu>
						<mcms-dropdown-label>My Account</mcms-dropdown-label>
						<button mcms-dropdown-item cdkMenuItem value="profile">Profile</button>
						<button mcms-dropdown-item cdkMenuItem value="settings">Settings</button>
						<mcms-dropdown-separator />
						<mcms-dropdown-label>Team</mcms-dropdown-label>
						<button mcms-dropdown-item cdkMenuItem value="invite">Invite members</button>
						<button mcms-dropdown-item cdkMenuItem value="team-settings">Team settings</button>
					</mcms-dropdown-menu>
				</ng-template>
			</div>
		`,
	}),
};

export const WithShortcuts: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="menu">Edit</button>
				<ng-template #menu>
					<mcms-dropdown-menu cdkMenu>
						<button mcms-dropdown-item cdkMenuItem value="undo" shortcut="⌘Z">Undo</button>
						<button mcms-dropdown-item cdkMenuItem value="redo" shortcut="⇧⌘Z">Redo</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="cut" shortcut="⌘X">Cut</button>
						<button mcms-dropdown-item cdkMenuItem value="copy" shortcut="⌘C">Copy</button>
						<button mcms-dropdown-item cdkMenuItem value="paste" shortcut="⌘V">Paste</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="select-all" shortcut="⌘A">Select All</button>
					</mcms-dropdown-menu>
				</ng-template>
			</div>
		`,
	}),
};

export const WithDisabledItems: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="menu">Options</button>
				<ng-template #menu>
					<mcms-dropdown-menu cdkMenu>
						<button mcms-dropdown-item cdkMenuItem value="new">New File</button>
						<button mcms-dropdown-item cdkMenuItem value="save">Save</button>
						<button mcms-dropdown-item cdkMenuItem value="save-as" [disabled]="true">Save As... (disabled)</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="export" [disabled]="true">Export (disabled)</button>
						<button mcms-dropdown-item cdkMenuItem value="print">Print</button>
					</mcms-dropdown-menu>
				</ng-template>
			</div>
		`,
	}),
};

export const ContextMenu: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem;">
				<div
					style="padding: 4rem; border: 2px dashed hsl(var(--mcms-border)); border-radius: 0.5rem; text-align: center; color: hsl(var(--mcms-muted-foreground));"
					[cdkContextMenuTriggerFor]="contextMenu"
				>
					Right-click here to open context menu
				</div>
				<ng-template #contextMenu>
					<mcms-dropdown-menu cdkMenu>
						<button mcms-dropdown-item cdkMenuItem value="back">Back</button>
						<button mcms-dropdown-item cdkMenuItem value="forward" [disabled]="true">Forward</button>
						<button mcms-dropdown-item cdkMenuItem value="reload">Reload</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="save">Save As...</button>
						<button mcms-dropdown-item cdkMenuItem value="print">Print...</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="inspect">Inspect</button>
					</mcms-dropdown-menu>
				</ng-template>
			</div>
		`,
	}),
};

export const FileMenu: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="menu">File</button>
				<ng-template #menu>
					<mcms-dropdown-menu cdkMenu>
						<button mcms-dropdown-item cdkMenuItem value="new" shortcut="⌘N">New</button>
						<button mcms-dropdown-item cdkMenuItem value="open" shortcut="⌘O">Open...</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="save" shortcut="⌘S">Save</button>
						<button mcms-dropdown-item cdkMenuItem value="save-as" shortcut="⇧⌘S">Save As...</button>
						<button mcms-dropdown-item cdkMenuItem value="save-all">Save All</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="export">Export</button>
						<button mcms-dropdown-item cdkMenuItem value="import">Import</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="close" shortcut="⌘W">Close</button>
					</mcms-dropdown-menu>
				</ng-template>
			</div>
		`,
	}),
};

export const UserMenu: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="ghost" [cdkMenuTriggerFor]="menu" style="display: flex; align-items: center; gap: 0.5rem;">
					<mcms-avatar size="sm">
						<mcms-avatar-fallback>JD</mcms-avatar-fallback>
					</mcms-avatar>
					<span>John Doe</span>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="m6 9 6 6 6-6"/>
					</svg>
				</button>
				<ng-template #menu>
					<mcms-dropdown-menu cdkMenu>
						<div style="padding: 0.5rem 0.75rem; font-size: 0.875rem;">
							<div style="font-weight: 500;">John Doe</div>
							<div style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">john@example.com</div>
						</div>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="profile">Profile</button>
						<button mcms-dropdown-item cdkMenuItem value="settings">Settings</button>
						<button mcms-dropdown-item cdkMenuItem value="keyboard">Keyboard shortcuts</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="team">Team</button>
						<button mcms-dropdown-item cdkMenuItem value="invite">Invite users</button>
						<mcms-dropdown-separator />
						<button mcms-dropdown-item cdkMenuItem value="logout">Log out</button>
					</mcms-dropdown-menu>
				</ng-template>
			</div>
		`,
	}),
};
