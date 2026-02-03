import type { Meta, StoryObj } from '@storybook/angular';
import { Menubar } from './menubar.component';

const meta: Meta<Menubar> = {
	title: 'Components/Navigation/Menubar',
	component: Menubar,
	tags: ['autodocs'],
	argTypes: {
		disabled: {
			control: 'boolean',
			description: 'Whether the menubar is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Menubar>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-menubar>
				<mcms-menubar-item value="file" label="File" [submenu]="fileMenu">
					<mcms-menubar-submenu #fileMenu>
						<mcms-menubar-item value="new" label="New" shortcut="⌘N" />
						<mcms-menubar-item value="open" label="Open" shortcut="⌘O" />
						<mcms-menubar-item value="save" label="Save" shortcut="⌘S" />
						<mcms-menubar-item value="save-as" label="Save As..." shortcut="⇧⌘S" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
				<mcms-menubar-item value="edit" label="Edit" [submenu]="editMenu">
					<mcms-menubar-submenu #editMenu>
						<mcms-menubar-item value="undo" label="Undo" shortcut="⌘Z" />
						<mcms-menubar-item value="redo" label="Redo" shortcut="⇧⌘Z" />
						<mcms-menubar-item value="cut" label="Cut" shortcut="⌘X" />
						<mcms-menubar-item value="copy" label="Copy" shortcut="⌘C" />
						<mcms-menubar-item value="paste" label="Paste" shortcut="⌘V" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
				<mcms-menubar-item value="view" label="View" [submenu]="viewMenu">
					<mcms-menubar-submenu #viewMenu>
						<mcms-menubar-item value="zoom-in" label="Zoom In" shortcut="⌘+" />
						<mcms-menubar-item value="zoom-out" label="Zoom Out" shortcut="⌘-" />
						<mcms-menubar-item value="reset-zoom" label="Reset Zoom" shortcut="⌘0" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
			</mcms-menubar>
		`,
	}),
};

export const WithHelp: Story = {
	render: () => ({
		template: `
			<mcms-menubar>
				<mcms-menubar-item value="file" label="File" [submenu]="fileMenu">
					<mcms-menubar-submenu #fileMenu>
						<mcms-menubar-item value="new" label="New Project" />
						<mcms-menubar-item value="open" label="Open Project" />
						<mcms-menubar-item value="recent" label="Recent Projects" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
				<mcms-menubar-item value="edit" label="Edit" [submenu]="editMenu">
					<mcms-menubar-submenu #editMenu>
						<mcms-menubar-item value="preferences" label="Preferences" />
						<mcms-menubar-item value="settings" label="Settings" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
				<mcms-menubar-item value="help" label="Help" [submenu]="helpMenu">
					<mcms-menubar-submenu #helpMenu>
						<mcms-menubar-item value="documentation" label="Documentation" />
						<mcms-menubar-item value="keyboard" label="Keyboard Shortcuts" />
						<mcms-menubar-item value="about" label="About" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
			</mcms-menubar>
		`,
	}),
};

export const SingleMenu: Story = {
	render: () => ({
		template: `
			<mcms-menubar>
				<mcms-menubar-item value="actions" label="Actions" [submenu]="actionsMenu">
					<mcms-menubar-submenu #actionsMenu>
						<mcms-menubar-item value="create" label="Create New" />
						<mcms-menubar-item value="duplicate" label="Duplicate" />
						<mcms-menubar-item value="delete" label="Delete" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
			</mcms-menubar>
		`,
	}),
};

export const ApplicationStyle: Story = {
	render: () => ({
		template: `
			<mcms-menubar>
				<mcms-menubar-item value="file" label="File" [submenu]="fileMenu">
					<mcms-menubar-submenu #fileMenu>
						<mcms-menubar-item value="new-tab" label="New Tab" shortcut="⌘T" />
						<mcms-menubar-item value="new-window" label="New Window" shortcut="⌘N" />
						<mcms-menubar-item value="close-tab" label="Close Tab" shortcut="⌘W" />
						<mcms-menubar-item value="quit" label="Quit" shortcut="⌘Q" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
				<mcms-menubar-item value="edit" label="Edit" [submenu]="editMenu">
					<mcms-menubar-submenu #editMenu>
						<mcms-menubar-item value="undo" label="Undo" shortcut="⌘Z" />
						<mcms-menubar-item value="redo" label="Redo" shortcut="⇧⌘Z" />
						<mcms-menubar-item value="find" label="Find..." shortcut="⌘F" />
						<mcms-menubar-item value="replace" label="Replace..." shortcut="⌥⌘F" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
				<mcms-menubar-item value="view" label="View" [submenu]="viewMenu">
					<mcms-menubar-submenu #viewMenu>
						<mcms-menubar-item value="sidebar" label="Toggle Sidebar" shortcut="⌘B" />
						<mcms-menubar-item value="fullscreen" label="Enter Fullscreen" shortcut="⌃⌘F" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
				<mcms-menubar-item value="window" label="Window" [submenu]="windowMenu">
					<mcms-menubar-submenu #windowMenu>
						<mcms-menubar-item value="minimize" label="Minimize" shortcut="⌘M" />
						<mcms-menubar-item value="zoom" label="Zoom" />
						<mcms-menubar-item value="tile-left" label="Tile Left" />
						<mcms-menubar-item value="tile-right" label="Tile Right" />
					</mcms-menubar-submenu>
				</mcms-menubar-item>
			</mcms-menubar>
		`,
	}),
};
