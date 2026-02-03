import type { Meta, StoryObj } from '@storybook/angular';
import { Separator } from './separator.component';

const meta: Meta<Separator> = {
	title: 'Components/Separator',
	component: Separator,
	tags: ['autodocs'],
	argTypes: {
		orientation: {
			control: 'radio',
			options: ['horizontal', 'vertical'],
			description: 'Orientation of the separator',
		},
		decorative: {
			control: 'boolean',
			description: 'Whether the separator is purely decorative',
		},
	},
};
export default meta;
type Story = StoryObj<Separator>;

export const Horizontal: Story = {
	args: {
		orientation: 'horizontal',
		decorative: true,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 400px;">
				<div style="margin-bottom: 1rem;">Content above</div>
				<mcms-separator [orientation]="orientation" [decorative]="decorative" />
				<div style="margin-top: 1rem;">Content below</div>
			</div>
		`,
	}),
};

export const Vertical: Story = {
	args: {
		orientation: 'vertical',
		decorative: true,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="display: flex; height: 24px; align-items: center; gap: 1rem;">
				<span>Left</span>
				<mcms-separator [orientation]="orientation" [decorative]="decorative" />
				<span>Right</span>
			</div>
		`,
	}),
};

export const WithContent: Story = {
	render: () => ({
		template: `
			<div style="max-width: 400px;">
				<h3 style="font-weight: 600; margin-bottom: 0.5rem;">Section Title</h3>
				<p style="color: hsl(var(--mcms-muted-foreground)); font-size: 0.875rem; margin-bottom: 1rem;">
					Some descriptive text about this section.
				</p>
				<mcms-separator />
				<p style="margin-top: 1rem; font-size: 0.875rem;">
					Content after the separator.
				</p>
			</div>
		`,
	}),
};

export const InlineList: Story = {
	render: () => ({
		template: `
			<div style="display: flex; align-items: center; height: 20px; gap: 0.75rem;">
				<span style="font-size: 0.875rem;">Home</span>
				<mcms-separator orientation="vertical" />
				<span style="font-size: 0.875rem;">Products</span>
				<mcms-separator orientation="vertical" />
				<span style="font-size: 0.875rem;">About</span>
				<mcms-separator orientation="vertical" />
				<span style="font-size: 0.875rem;">Contact</span>
			</div>
		`,
	}),
};

export const Semantic: Story = {
	args: {
		orientation: 'horizontal',
		decorative: false,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 400px;">
				<div style="margin-bottom: 1rem;">Content above (semantically separated)</div>
				<mcms-separator [orientation]="orientation" [decorative]="decorative" />
				<div style="margin-top: 1rem;">Content below (semantically separated)</div>
			</div>
		`,
	}),
};

export const InCard: Story = {
	render: () => ({
		template: `
			<div style="border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem; padding: 1rem; max-width: 350px;">
				<h4 style="font-weight: 600; margin-bottom: 0.25rem;">Card Title</h4>
				<p style="color: hsl(var(--mcms-muted-foreground)); font-size: 0.875rem;">Card description text.</p>
				<mcms-separator class="my-4" />
				<div style="display: flex; gap: 0.5rem;">
					<button mcms-button variant="outline" size="sm">Cancel</button>
					<button mcms-button size="sm">Save</button>
				</div>
			</div>
		`,
	}),
};
