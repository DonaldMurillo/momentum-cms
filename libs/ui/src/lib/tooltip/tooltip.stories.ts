import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TooltipTrigger } from './tooltip-trigger.directive';
import { Button } from '../button/button.component';

const meta: Meta<TooltipTrigger> = {
	title: 'Components/Overlay/Tooltip',
	component: TooltipTrigger,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [TooltipTrigger, Button],
		}),
	],
	argTypes: {
		mcmsTooltip: {
			control: 'text',
			description: 'Tooltip content text',
		},
		tooltipPosition: {
			control: 'select',
			options: ['top', 'right', 'bottom', 'left'],
			description: 'Tooltip position relative to trigger',
		},
		tooltipDelay: {
			control: 'number',
			description: 'Delay in ms before showing tooltip',
		},
		tooltipDisabled: {
			control: 'boolean',
			description: 'Whether the tooltip is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<TooltipTrigger>;

export const Default: Story = {
	args: {
		mcmsTooltip: 'This is a tooltip',
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button [mcmsTooltip]="mcmsTooltip">Hover me</button>
			</div>
		`,
	}),
};

export const PositionTop: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button [mcmsTooltip]="'Tooltip on top'" tooltipPosition="top">Top</button>
			</div>
		`,
	}),
};

export const PositionRight: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button [mcmsTooltip]="'Tooltip on right'" tooltipPosition="right">Right</button>
			</div>
		`,
	}),
};

export const PositionBottom: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button [mcmsTooltip]="'Tooltip on bottom'" tooltipPosition="bottom">Bottom</button>
			</div>
		`,
	}),
};

export const PositionLeft: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button [mcmsTooltip]="'Tooltip on left'" tooltipPosition="left">Left</button>
			</div>
		`,
	}),
};

export const AllPositions: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; display: flex; flex-direction: column; align-items: center; gap: 2rem;">
				<button mcms-button variant="outline" [mcmsTooltip]="'Top tooltip'" tooltipPosition="top">Top</button>
				<div style="display: flex; gap: 4rem;">
					<button mcms-button variant="outline" [mcmsTooltip]="'Left tooltip'" tooltipPosition="left">Left</button>
					<button mcms-button variant="outline" [mcmsTooltip]="'Right tooltip'" tooltipPosition="right">Right</button>
				</div>
				<button mcms-button variant="outline" [mcmsTooltip]="'Bottom tooltip'" tooltipPosition="bottom">Bottom</button>
			</div>
		`,
	}),
};

export const WithIcons: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; display: flex; gap: 1rem; justify-content: center;">
				<button mcms-button variant="ghost" size="icon" [mcmsTooltip]="'Edit'">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
					</svg>
				</button>
				<button mcms-button variant="ghost" size="icon" [mcmsTooltip]="'Delete'">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
						<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
					</svg>
				</button>
				<button mcms-button variant="ghost" size="icon" [mcmsTooltip]="'Settings'">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="3"/>
						<path d="M12 1v6m0 6v10"/>
					</svg>
				</button>
			</div>
		`,
	}),
};

export const LongContent: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button [mcmsTooltip]="'This is a longer tooltip that contains more detailed information about the action'">
					Hover for details
				</button>
			</div>
		`,
	}),
};

export const Disabled: Story = {
	args: {
		tooltipDisabled: true,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button [mcmsTooltip]="'This tooltip is disabled'" [tooltipDisabled]="tooltipDisabled">
					Tooltip disabled
				</button>
			</div>
		`,
	}),
};

export const CustomDelay: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; display: flex; gap: 1rem; justify-content: center;">
				<button mcms-button variant="outline" [mcmsTooltip]="'Instant (0ms)'" [tooltipDelay]="0">No delay</button>
				<button mcms-button variant="outline" [mcmsTooltip]="'Default (300ms)'" [tooltipDelay]="300">Default</button>
				<button mcms-button variant="outline" [mcmsTooltip]="'Slow (1000ms)'" [tooltipDelay]="1000">1s delay</button>
			</div>
		`,
	}),
};
