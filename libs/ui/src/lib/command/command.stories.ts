import type { Meta, StoryObj } from '@storybook/angular';
import { Command } from './command.component';

const meta: Meta<Command> = {
	title: 'Components/Data/Command',
	component: Command,
	tags: ['autodocs'],
	argTypes: {
		disabled: {
			control: 'boolean',
			description: 'Whether the command is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Command>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-command style="max-width: 400px; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem;">
				<mcms-command-input placeholder="Type a command or search..." />
				<mcms-command-list>
					<mcms-command-empty>No results found.</mcms-command-empty>
					<mcms-command-group label="Suggestions">
						<mcms-command-item value="calendar">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>
							</svg>
							Calendar
						</mcms-command-item>
						<mcms-command-item value="search">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
							</svg>
							Search
						</mcms-command-item>
						<mcms-command-item value="settings">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<circle cx="12" cy="12" r="3"/>
								<path d="M12 1v6m0 6v10"/>
							</svg>
							Settings
						</mcms-command-item>
					</mcms-command-group>
				</mcms-command-list>
			</mcms-command>
		`,
	}),
};

export const WithMultipleGroups: Story = {
	render: () => ({
		template: `
			<mcms-command style="max-width: 400px; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem;">
				<mcms-command-input placeholder="Search commands..." />
				<mcms-command-list>
					<mcms-command-empty>No results found.</mcms-command-empty>
					<mcms-command-group label="Actions">
						<mcms-command-item value="new-file">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
								<path d="M14 2v4a2 2 0 0 0 2 2h4"/>
							</svg>
							New File
						</mcms-command-item>
						<mcms-command-item value="new-folder">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
							</svg>
							New Folder
						</mcms-command-item>
					</mcms-command-group>
					<mcms-command-separator />
					<mcms-command-group label="Settings">
						<mcms-command-item value="profile">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.5 8.5 0 0 1 13 0"/>
							</svg>
							Profile
						</mcms-command-item>
						<mcms-command-item value="billing">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
							</svg>
							Billing
						</mcms-command-item>
						<mcms-command-item value="preferences">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<circle cx="12" cy="12" r="3"/>
							</svg>
							Preferences
						</mcms-command-item>
					</mcms-command-group>
				</mcms-command-list>
			</mcms-command>
		`,
	}),
};

export const WithShortcuts: Story = {
	render: () => ({
		template: `
			<mcms-command style="max-width: 400px; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem;">
				<mcms-command-input placeholder="Type a command..." />
				<mcms-command-list>
					<mcms-command-group label="Editor">
						<mcms-command-item value="save">
							<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
								<span style="display: flex; align-items: center;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
										<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
									</svg>
									Save
								</span>
								<kbd style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); background: hsl(var(--mcms-muted)); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">⌘S</kbd>
							</div>
						</mcms-command-item>
						<mcms-command-item value="undo">
							<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
								<span style="display: flex; align-items: center;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
										<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
									</svg>
									Undo
								</span>
								<kbd style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); background: hsl(var(--mcms-muted)); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">⌘Z</kbd>
							</div>
						</mcms-command-item>
						<mcms-command-item value="redo">
							<div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
								<span style="display: flex; align-items: center;">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
										<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
									</svg>
									Redo
								</span>
								<kbd style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); background: hsl(var(--mcms-muted)); padding: 0.125rem 0.375rem; border-radius: 0.25rem;">⇧⌘Z</kbd>
							</div>
						</mcms-command-item>
					</mcms-command-group>
				</mcms-command-list>
			</mcms-command>
		`,
	}),
};

export const WithDisabledItems: Story = {
	render: () => ({
		template: `
			<mcms-command style="max-width: 400px; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem;">
				<mcms-command-input placeholder="Search..." />
				<mcms-command-list>
					<mcms-command-group label="Options">
						<mcms-command-item value="available-1">Available Option</mcms-command-item>
						<mcms-command-item value="disabled-1" [disabled]="true">Disabled Option</mcms-command-item>
						<mcms-command-item value="available-2">Another Available Option</mcms-command-item>
						<mcms-command-item value="disabled-2" [disabled]="true">Also Disabled</mcms-command-item>
					</mcms-command-group>
				</mcms-command-list>
			</mcms-command>
		`,
	}),
};

export const SearchPalette: Story = {
	render: () => ({
		template: `
			<mcms-command style="max-width: 500px; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem;">
				<mcms-command-input placeholder="Search for pages, actions, or settings..." />
				<mcms-command-list style="max-height: 300px;">
					<mcms-command-empty>No results found.</mcms-command-empty>
					<mcms-command-group label="Pages">
						<mcms-command-item value="dashboard">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
							</svg>
							Dashboard
						</mcms-command-item>
						<mcms-command-item value="projects">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
							</svg>
							Projects
						</mcms-command-item>
						<mcms-command-item value="team">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>
							</svg>
							Team
						</mcms-command-item>
					</mcms-command-group>
					<mcms-command-separator />
					<mcms-command-group label="Quick Actions">
						<mcms-command-item value="create-project">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<path d="M12 5v14m-7-7h14"/>
							</svg>
							Create New Project
						</mcms-command-item>
						<mcms-command-item value="invite-member">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
								<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>
							</svg>
							Invite Team Member
						</mcms-command-item>
					</mcms-command-group>
				</mcms-command-list>
			</mcms-command>
		`,
	}),
};

export const Empty: Story = {
	render: () => ({
		template: `
			<mcms-command style="max-width: 400px; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem;">
				<mcms-command-input placeholder="Search..." value="xyz123" />
				<mcms-command-list>
					<mcms-command-empty>
						<div style="display: flex; flex-direction: column; align-items: center; padding: 1rem;">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: hsl(var(--mcms-muted-foreground)); margin-bottom: 0.5rem;">
								<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
							</svg>
							<p style="color: hsl(var(--mcms-muted-foreground)); font-size: 0.875rem;">No results found.</p>
						</div>
					</mcms-command-empty>
				</mcms-command-list>
			</mcms-command>
		`,
	}),
};
