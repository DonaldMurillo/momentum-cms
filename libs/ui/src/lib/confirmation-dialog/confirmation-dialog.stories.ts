import type { Meta, StoryObj } from '@storybook/angular';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

const meta: Meta<ConfirmationDialogComponent> = {
	title: 'Components/Overlay/ConfirmationDialog',
	component: ConfirmationDialogComponent,
	tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ConfirmationDialogComponent>;

export const Default: Story = {
	render: () => ({
		template: `
			<div style="padding: 2rem;">
				<mcms-dialog style="width: 400px;">
					<mcms-dialog-header>
						<mcms-dialog-title>Are you sure?</mcms-dialog-title>
						<mcms-dialog-description>
							This action cannot be undone. This will permanently delete your account.
						</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline">Cancel</button>
						<button mcms-button variant="primary">Confirm</button>
					</mcms-dialog-footer>
				</mcms-dialog>
			</div>
		`,
	}),
};

export const Destructive: Story = {
	render: () => ({
		template: `
			<div style="padding: 2rem;">
				<mcms-dialog style="width: 400px;">
					<mcms-dialog-header>
						<div style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 9999px; margin: 0 auto 1rem; background: hsl(var(--mcms-destructive) / 0.1); color: hsl(var(--mcms-destructive));">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10" />
								<path d="m15 9-6 6" />
								<path d="m9 9 6 6" />
							</svg>
						</div>
						<mcms-dialog-title style="text-align: center;">Delete Item?</mcms-dialog-title>
						<mcms-dialog-description style="text-align: center;">
							This action cannot be undone. This item will be permanently deleted.
						</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline">Cancel</button>
						<button mcms-button variant="destructive">Delete</button>
					</mcms-dialog-footer>
				</mcms-dialog>
			</div>
		`,
	}),
};

export const Warning: Story = {
	render: () => ({
		template: `
			<div style="padding: 2rem;">
				<mcms-dialog style="width: 400px;">
					<mcms-dialog-header>
						<div style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 9999px; margin: 0 auto 1rem; background: hsl(var(--mcms-warning) / 0.1); color: hsl(var(--mcms-warning));">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
								<path d="M12 9v4" />
								<path d="M12 17h.01" />
							</svg>
						</div>
						<mcms-dialog-title style="text-align: center;">Unsaved Changes</mcms-dialog-title>
						<mcms-dialog-description style="text-align: center;">
							You have unsaved changes. Do you want to save before leaving?
						</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline">Discard</button>
						<button mcms-button variant="primary">Save Changes</button>
					</mcms-dialog-footer>
				</mcms-dialog>
			</div>
		`,
	}),
};

export const Info: Story = {
	render: () => ({
		template: `
			<div style="padding: 2rem;">
				<mcms-dialog style="width: 400px;">
					<mcms-dialog-header>
						<div style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 9999px; margin: 0 auto 1rem; background: hsl(var(--mcms-info) / 0.1); color: hsl(var(--mcms-info));">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10" />
								<path d="M12 16v-4" />
								<path d="M12 8h.01" />
							</svg>
						</div>
						<mcms-dialog-title style="text-align: center;">New Update Available</mcms-dialog-title>
						<mcms-dialog-description style="text-align: center;">
							A new version of the application is available. Would you like to update now?
						</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline">Later</button>
						<button mcms-button variant="primary">Update Now</button>
					</mcms-dialog-footer>
				</mcms-dialog>
			</div>
		`,
	}),
};

export const Question: Story = {
	render: () => ({
		template: `
			<div style="padding: 2rem;">
				<mcms-dialog style="width: 400px;">
					<mcms-dialog-header>
						<div style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 9999px; margin: 0 auto 1rem; background: hsl(var(--mcms-primary) / 0.1); color: hsl(var(--mcms-primary));">
							<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10" />
								<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
								<path d="M12 17h.01" />
							</svg>
						</div>
						<mcms-dialog-title style="text-align: center;">Enable Notifications?</mcms-dialog-title>
						<mcms-dialog-description style="text-align: center;">
							We'll send you updates about your projects and team activity.
						</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline">No Thanks</button>
						<button mcms-button variant="primary">Enable</button>
					</mcms-dialog-footer>
				</mcms-dialog>
			</div>
		`,
	}),
};

export const AllVariants: Story = {
	render: () => ({
		template: `
			<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; padding: 2rem;">
				<!-- Default -->
				<mcms-dialog style="width: 100%;">
					<mcms-dialog-header>
						<mcms-dialog-title>Confirm Action</mcms-dialog-title>
						<mcms-dialog-description>Are you sure you want to proceed?</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline" size="sm">Cancel</button>
						<button mcms-button variant="primary" size="sm">Confirm</button>
					</mcms-dialog-footer>
				</mcms-dialog>

				<!-- Destructive -->
				<mcms-dialog style="width: 100%;">
					<mcms-dialog-header>
						<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 9999px; margin: 0 auto 0.75rem; background: hsl(var(--mcms-destructive) / 0.1); color: hsl(var(--mcms-destructive));">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
							</svg>
						</div>
						<mcms-dialog-title style="text-align: center;">Delete Item</mcms-dialog-title>
						<mcms-dialog-description style="text-align: center;">This action is permanent.</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline" size="sm">Cancel</button>
						<button mcms-button variant="destructive" size="sm">Delete</button>
					</mcms-dialog-footer>
				</mcms-dialog>

				<!-- Warning -->
				<mcms-dialog style="width: 100%;">
					<mcms-dialog-header>
						<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 9999px; margin: 0 auto 0.75rem; background: hsl(var(--mcms-warning) / 0.1); color: hsl(var(--mcms-warning));">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
								<path d="M12 9v4" /><path d="M12 17h.01" />
							</svg>
						</div>
						<mcms-dialog-title style="text-align: center;">Warning</mcms-dialog-title>
						<mcms-dialog-description style="text-align: center;">Please save your changes.</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline" size="sm">Discard</button>
						<button mcms-button variant="primary" size="sm">Save</button>
					</mcms-dialog-footer>
				</mcms-dialog>

				<!-- Info -->
				<mcms-dialog style="width: 100%;">
					<mcms-dialog-header>
						<div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 9999px; margin: 0 auto 0.75rem; background: hsl(var(--mcms-info) / 0.1); color: hsl(var(--mcms-info));">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
							</svg>
						</div>
						<mcms-dialog-title style="text-align: center;">Information</mcms-dialog-title>
						<mcms-dialog-description style="text-align: center;">Update is available.</mcms-dialog-description>
					</mcms-dialog-header>
					<mcms-dialog-footer>
						<button mcms-button variant="outline" size="sm">Later</button>
						<button mcms-button variant="primary" size="sm">Update</button>
					</mcms-dialog-footer>
				</mcms-dialog>
			</div>
		`,
	}),
};
