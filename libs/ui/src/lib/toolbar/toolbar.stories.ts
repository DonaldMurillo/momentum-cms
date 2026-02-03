import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Toolbar } from './toolbar.component';
import { ToolbarWidget } from './toolbar-widget.component';
import { ToolbarSeparator } from './toolbar-separator.component';
import { ToolbarWidgetGroup } from './toolbar-widget-group.component';

const meta: Meta<Toolbar> = {
	title: 'Components/Navigation/Toolbar',
	component: Toolbar,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Toolbar, ToolbarWidget, ToolbarSeparator, ToolbarWidgetGroup],
		}),
	],
	argTypes: {
		orientation: {
			control: 'select',
			options: ['horizontal', 'vertical'],
			description: 'Toolbar orientation',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the toolbar is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Toolbar>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-toolbar>
				<button mcms-toolbar-widget value="bold">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
						<path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
					</svg>
				</button>
				<button mcms-toolbar-widget value="italic">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="19" x2="10" y1="4" y2="4"/>
						<line x1="14" x2="5" y1="20" y2="20"/>
						<line x1="15" x2="9" y1="4" y2="20"/>
					</svg>
				</button>
				<button mcms-toolbar-widget value="underline">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M6 4v6a6 6 0 0 0 12 0V4"/>
						<line x1="4" x2="20" y1="20" y2="20"/>
					</svg>
				</button>
			</mcms-toolbar>
		`,
	}),
};

export const WithSeparator: Story = {
	render: () => ({
		template: `
			<mcms-toolbar>
				<button mcms-toolbar-widget value="bold">Bold</button>
				<button mcms-toolbar-widget value="italic">Italic</button>
				<button mcms-toolbar-widget value="underline">Underline</button>
				<mcms-toolbar-separator />
				<button mcms-toolbar-widget value="align-left">Left</button>
				<button mcms-toolbar-widget value="align-center">Center</button>
				<button mcms-toolbar-widget value="align-right">Right</button>
			</mcms-toolbar>
		`,
	}),
};

export const TextFormatting: Story = {
	render: () => ({
		template: `
			<mcms-toolbar>
				<mcms-toolbar-widget-group>
					<button mcms-toolbar-widget value="bold">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
							<path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
						</svg>
					</button>
					<button mcms-toolbar-widget value="italic">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="19" x2="10" y1="4" y2="4"/>
							<line x1="14" x2="5" y1="20" y2="20"/>
							<line x1="15" x2="9" y1="4" y2="20"/>
						</svg>
					</button>
					<button mcms-toolbar-widget value="strike">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M16 4H9a3 3 0 0 0-2.83 4"/>
							<path d="M14 12a4 4 0 0 1 0 8H6"/>
							<line x1="4" x2="20" y1="12" y2="12"/>
						</svg>
					</button>
				</mcms-toolbar-widget-group>
				<mcms-toolbar-separator />
				<mcms-toolbar-widget-group>
					<button mcms-toolbar-widget value="list">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="8" x2="21" y1="6" y2="6"/>
							<line x1="8" x2="21" y1="12" y2="12"/>
							<line x1="8" x2="21" y1="18" y2="18"/>
							<line x1="3" x2="3.01" y1="6" y2="6"/>
							<line x1="3" x2="3.01" y1="12" y2="12"/>
							<line x1="3" x2="3.01" y1="18" y2="18"/>
						</svg>
					</button>
					<button mcms-toolbar-widget value="numbered-list">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="10" x2="21" y1="6" y2="6"/>
							<line x1="10" x2="21" y1="12" y2="12"/>
							<line x1="10" x2="21" y1="18" y2="18"/>
							<path d="M4 6h1v4"/>
							<path d="M4 10h2"/>
							<path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
						</svg>
					</button>
				</mcms-toolbar-widget-group>
				<mcms-toolbar-separator />
				<button mcms-toolbar-widget value="link">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
					</svg>
				</button>
			</mcms-toolbar>
		`,
	}),
};

export const Vertical: Story = {
	args: {
		orientation: 'vertical',
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-toolbar [orientation]="orientation">
				<button mcms-toolbar-widget value="select">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
					</svg>
				</button>
				<button mcms-toolbar-widget value="rectangle">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="18" height="18" rx="2"/>
					</svg>
				</button>
				<button mcms-toolbar-widget value="circle">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"/>
					</svg>
				</button>
				<mcms-toolbar-separator />
				<button mcms-toolbar-widget value="text">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="4 7 4 4 20 4 20 7"/>
						<line x1="9" x2="15" y1="20" y2="20"/>
						<line x1="12" x2="12" y1="4" y2="20"/>
					</svg>
				</button>
			</mcms-toolbar>
		`,
	}),
};

export const Disabled: Story = {
	args: {
		disabled: true,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-toolbar [disabled]="disabled">
				<button mcms-toolbar-widget value="action1">Action 1</button>
				<button mcms-toolbar-widget value="action2">Action 2</button>
				<button mcms-toolbar-widget value="action3">Action 3</button>
			</mcms-toolbar>
		`,
	}),
};

export const WithDisabledWidget: Story = {
	render: () => ({
		template: `
			<mcms-toolbar>
				<button mcms-toolbar-widget value="enabled1">Enabled</button>
				<button mcms-toolbar-widget value="disabled" [disabled]="true">Disabled</button>
				<button mcms-toolbar-widget value="enabled2">Enabled</button>
			</mcms-toolbar>
		`,
	}),
};

export const MediaControls: Story = {
	render: () => ({
		template: `
			<mcms-toolbar>
				<button mcms-toolbar-widget value="prev">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="19 20 9 12 19 4 19 20"/>
						<line x1="5" x2="5" y1="19" y2="5"/>
					</svg>
				</button>
				<button mcms-toolbar-widget value="play">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="5 3 19 12 5 21 5 3"/>
					</svg>
				</button>
				<button mcms-toolbar-widget value="next">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="5 4 15 12 5 20 5 4"/>
						<line x1="19" x2="19" y1="5" y2="19"/>
					</svg>
				</button>
				<mcms-toolbar-separator />
				<button mcms-toolbar-widget value="volume">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
						<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
						<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
					</svg>
				</button>
				<button mcms-toolbar-widget value="settings">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="3"/>
						<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
					</svg>
				</button>
			</mcms-toolbar>
		`,
	}),
};
