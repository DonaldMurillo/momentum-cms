import type { Meta, StoryObj } from '@storybook/angular';
import { PopoverContent } from './popover-content.component';

const meta: Meta<PopoverContent> = {
	title: 'Components/Overlay/Popover',
	component: PopoverContent,
	tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<PopoverContent>;

export const Default: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="popover">Open Popover</button>
				<ng-template #popover>
					<mcms-popover-content cdkMenu>
						<div style="padding: 0.75rem; min-width: 200px;">
							<h4 style="font-weight: 500; margin-bottom: 0.5rem;">Popover Title</h4>
							<p style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground));">
								This is some popover content that can contain any elements.
							</p>
						</div>
					</mcms-popover-content>
				</ng-template>
			</div>
		`,
	}),
};

export const WithForm: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="popover">Update Settings</button>
				<ng-template #popover>
					<mcms-popover-content cdkMenu>
						<div style="padding: 1rem; min-width: 280px;">
							<h4 style="font-weight: 500; margin-bottom: 1rem;">Display Settings</h4>
							<div style="display: flex; flex-direction: column; gap: 0.75rem;">
								<mcms-form-field>
									<mcms-form-field-label>Width</mcms-form-field-label>
									<mcms-input type="number" placeholder="100" />
								</mcms-form-field>
								<mcms-form-field>
									<mcms-form-field-label>Height</mcms-form-field-label>
									<mcms-input type="number" placeholder="100" />
								</mcms-form-field>
							</div>
							<div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
								<button mcms-button size="sm">Apply</button>
							</div>
						</div>
					</mcms-popover-content>
				</ng-template>
			</div>
		`,
	}),
};

export const WithList: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="outline" [cdkMenuTriggerFor]="popover">Show Options</button>
				<ng-template #popover>
					<mcms-popover-content cdkMenu>
						<div style="padding: 0.5rem 0; min-width: 180px;">
							<div style="padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 500; color: hsl(var(--mcms-muted-foreground));">
								OPTIONS
							</div>
							<button style="width: 100%; padding: 0.5rem 1rem; text-align: left; background: none; border: none; cursor: pointer; font-size: 0.875rem;" onmouseover="this.style.background='hsl(var(--mcms-accent))'" onmouseout="this.style.background='none'">
								Option 1
							</button>
							<button style="width: 100%; padding: 0.5rem 1rem; text-align: left; background: none; border: none; cursor: pointer; font-size: 0.875rem;" onmouseover="this.style.background='hsl(var(--mcms-accent))'" onmouseout="this.style.background='none'">
								Option 2
							</button>
							<button style="width: 100%; padding: 0.5rem 1rem; text-align: left; background: none; border: none; cursor: pointer; font-size: 0.875rem;" onmouseover="this.style.background='hsl(var(--mcms-accent))'" onmouseout="this.style.background='none'">
								Option 3
							</button>
						</div>
					</mcms-popover-content>
				</ng-template>
			</div>
		`,
	}),
};

export const UserProfile: Story = {
	render: () => ({
		template: `
			<div style="padding: 4rem; text-align: center;">
				<button mcms-button variant="ghost" size="icon" [cdkMenuTriggerFor]="popover" style="border-radius: 9999px;">
					<mcms-avatar size="sm">
						<mcms-avatar-fallback>JD</mcms-avatar-fallback>
					</mcms-avatar>
				</button>
				<ng-template #popover>
					<mcms-popover-content cdkMenu>
						<div style="padding: 1rem; min-width: 240px;">
							<div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem;">
								<mcms-avatar>
									<mcms-avatar-fallback>JD</mcms-avatar-fallback>
								</mcms-avatar>
								<div>
									<div style="font-weight: 500;">John Doe</div>
									<div style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">john@example.com</div>
								</div>
							</div>
							<div style="border-top: 1px solid hsl(var(--mcms-border)); padding-top: 0.5rem;">
								<button style="width: 100%; padding: 0.5rem; text-align: left; background: none; border: none; cursor: pointer; font-size: 0.875rem; border-radius: 0.25rem;" onmouseover="this.style.background='hsl(var(--mcms-accent))'" onmouseout="this.style.background='none'">
									Profile Settings
								</button>
								<button style="width: 100%; padding: 0.5rem; text-align: left; background: none; border: none; cursor: pointer; font-size: 0.875rem; border-radius: 0.25rem;" onmouseover="this.style.background='hsl(var(--mcms-accent))'" onmouseout="this.style.background='none'">
									Sign Out
								</button>
							</div>
						</div>
					</mcms-popover-content>
				</ng-template>
			</div>
		`,
	}),
};

export const ContentOnly: Story = {
	render: () => ({
		template: `
			<mcms-popover-content style="max-width: 300px;">
				<div style="padding: 1rem;">
					<h4 style="font-weight: 500; margin-bottom: 0.5rem;">Standalone Popover</h4>
					<p style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground));">
						This shows the popover content component without a trigger, useful for demonstrating the styling.
					</p>
				</div>
			</mcms-popover-content>
		`,
	}),
};
