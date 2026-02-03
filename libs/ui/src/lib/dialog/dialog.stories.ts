import type { Meta, StoryObj } from '@storybook/angular';
import { Dialog } from './dialog.component';

const meta: Meta<Dialog> = {
	title: 'Components/Overlay/Dialog',
	component: Dialog,
	tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<Dialog>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-dialog style="width: 400px;">
				<mcms-dialog-header>
					<mcms-dialog-title>Edit Profile</mcms-dialog-title>
					<mcms-dialog-description>
						Make changes to your profile here. Click save when you're done.
					</mcms-dialog-description>
				</mcms-dialog-header>
				<mcms-dialog-content>
					<div style="display: flex; flex-direction: column; gap: 1rem;">
						<mcms-form-field>
							<mcms-form-field-label>Name</mcms-form-field-label>
							<mcms-input placeholder="Enter your name" />
						</mcms-form-field>
						<mcms-form-field>
							<mcms-form-field-label>Username</mcms-form-field-label>
							<mcms-input placeholder="Enter username" />
						</mcms-form-field>
					</div>
				</mcms-dialog-content>
				<mcms-dialog-footer>
					<button mcms-button variant="outline">Cancel</button>
					<button mcms-button variant="primary">Save changes</button>
				</mcms-dialog-footer>
			</mcms-dialog>
		`,
	}),
};

export const Simple: Story = {
	render: () => ({
		template: `
			<mcms-dialog style="width: 350px;">
				<mcms-dialog-header>
					<mcms-dialog-title>Are you sure?</mcms-dialog-title>
					<mcms-dialog-description>
						This action cannot be undone.
					</mcms-dialog-description>
				</mcms-dialog-header>
				<mcms-dialog-footer>
					<button mcms-button variant="outline">Cancel</button>
					<button mcms-button variant="destructive">Delete</button>
				</mcms-dialog-footer>
			</mcms-dialog>
		`,
	}),
};

export const WithScrollableContent: Story = {
	render: () => ({
		template: `
			<mcms-dialog style="width: 450px; max-height: 400px;">
				<mcms-dialog-header>
					<mcms-dialog-title>Terms of Service</mcms-dialog-title>
					<mcms-dialog-description>
						Please read and accept our terms of service.
					</mcms-dialog-description>
				</mcms-dialog-header>
				<mcms-dialog-content style="overflow-y: auto; max-height: 200px;">
					<div style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground)); line-height: 1.5;">
						<p style="margin-bottom: 1rem;">
							Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
						</p>
						<p style="margin-bottom: 1rem;">
							Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
						</p>
						<p style="margin-bottom: 1rem;">
							Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
						</p>
						<p>
							Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
						</p>
					</div>
				</mcms-dialog-content>
				<mcms-dialog-footer>
					<button mcms-button variant="outline">Decline</button>
					<button mcms-button variant="primary">Accept</button>
				</mcms-dialog-footer>
			</mcms-dialog>
		`,
	}),
};

export const ShareDocument: Story = {
	render: () => ({
		template: `
			<mcms-dialog style="width: 450px;">
				<mcms-dialog-header>
					<mcms-dialog-title>Share Document</mcms-dialog-title>
					<mcms-dialog-description>
						Anyone with the link can view this document.
					</mcms-dialog-description>
				</mcms-dialog-header>
				<mcms-dialog-content>
					<div style="display: flex; flex-direction: column; gap: 1rem;">
						<div style="display: flex; gap: 0.5rem;">
							<mcms-input value="https://example.com/doc/abc123" style="flex: 1;" readonly />
							<button mcms-button variant="secondary">Copy</button>
						</div>
						<mcms-separator />
						<div>
							<mcms-form-field-label>People with access</mcms-form-field-label>
							<div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
								<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-radius: 0.375rem; background: hsl(var(--mcms-muted));">
									<mcms-avatar size="sm">
										<mcms-avatar-fallback>JD</mcms-avatar-fallback>
									</mcms-avatar>
									<div style="flex: 1;">
										<div style="font-size: 0.875rem; font-weight: 500;">John Doe</div>
										<div style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">Owner</div>
									</div>
								</div>
								<div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-radius: 0.375rem; background: hsl(var(--mcms-muted));">
									<mcms-avatar size="sm">
										<mcms-avatar-fallback>JS</mcms-avatar-fallback>
									</mcms-avatar>
									<div style="flex: 1;">
										<div style="font-size: 0.875rem; font-weight: 500;">Jane Smith</div>
										<div style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">Can edit</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</mcms-dialog-content>
				<mcms-dialog-footer>
					<button mcms-button variant="outline">Close</button>
				</mcms-dialog-footer>
			</mcms-dialog>
		`,
	}),
};

export const CreateProject: Story = {
	render: () => ({
		template: `
			<mcms-dialog style="width: 500px;">
				<mcms-dialog-header>
					<mcms-dialog-title>Create New Project</mcms-dialog-title>
					<mcms-dialog-description>
						Set up a new project to organize your work.
					</mcms-dialog-description>
				</mcms-dialog-header>
				<mcms-dialog-content>
					<div style="display: flex; flex-direction: column; gap: 1rem;">
						<mcms-form-field>
							<mcms-form-field-label>Project Name</mcms-form-field-label>
							<mcms-input placeholder="Enter project name" />
						</mcms-form-field>
						<mcms-form-field>
							<mcms-form-field-label>Description</mcms-form-field-label>
							<mcms-textarea placeholder="Describe your project..." rows="3"></mcms-textarea>
						</mcms-form-field>
						<mcms-form-field>
							<mcms-form-field-label>Visibility</mcms-form-field-label>
							<mcms-radio-group value="private">
								<mcms-radio-group-item value="public">Public - Anyone can see this project</mcms-radio-group-item>
								<mcms-radio-group-item value="private">Private - Only you and invited members</mcms-radio-group-item>
							</mcms-radio-group>
						</mcms-form-field>
					</div>
				</mcms-dialog-content>
				<mcms-dialog-footer>
					<button mcms-button variant="outline">Cancel</button>
					<button mcms-button variant="primary">Create Project</button>
				</mcms-dialog-footer>
			</mcms-dialog>
		`,
	}),
};

export const TitleOnly: Story = {
	render: () => ({
		template: `
			<mcms-dialog style="width: 350px;">
				<mcms-dialog-header>
					<mcms-dialog-title>Notification</mcms-dialog-title>
				</mcms-dialog-header>
				<mcms-dialog-content>
					<p style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground));">
						Your changes have been saved successfully.
					</p>
				</mcms-dialog-content>
				<mcms-dialog-footer>
					<button mcms-button variant="primary">OK</button>
				</mcms-dialog-footer>
			</mcms-dialog>
		`,
	}),
};
