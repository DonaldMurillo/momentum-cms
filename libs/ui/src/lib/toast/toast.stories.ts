import type { Meta, StoryObj } from '@storybook/angular';
import { ToastComponent } from './toast.component';

const meta: Meta<ToastComponent> = {
	title: 'Components/Overlay/Toast',
	component: ToastComponent,
	tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ToastComponent>;

export const Default: Story = {
	render: () => ({
		props: {
			toast: {
				id: '1',
				title: 'Event Created',
				description: 'Your event has been created successfully.',
				variant: 'default',
				dismissible: true,
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const Success: Story = {
	render: () => ({
		props: {
			toast: {
				id: '2',
				title: 'Success!',
				description: 'Your changes have been saved.',
				variant: 'success',
				dismissible: true,
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const Destructive: Story = {
	render: () => ({
		props: {
			toast: {
				id: '3',
				title: 'Error',
				description: 'Something went wrong. Please try again.',
				variant: 'destructive',
				dismissible: true,
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const Warning: Story = {
	render: () => ({
		props: {
			toast: {
				id: '4',
				title: 'Warning',
				description: 'Your session will expire in 5 minutes.',
				variant: 'warning',
				dismissible: true,
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const WithAction: Story = {
	render: () => ({
		props: {
			toast: {
				id: '5',
				title: 'Scheduled',
				description: 'Your event has been scheduled for tomorrow.',
				variant: 'default',
				dismissible: true,
				action: {
					label: 'Undo',
					onClick: () => console.warn('Undo clicked'),
				},
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const TitleOnly: Story = {
	render: () => ({
		props: {
			toast: {
				id: '6',
				title: 'Settings saved',
				variant: 'success',
				dismissible: true,
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const NonDismissible: Story = {
	render: () => ({
		props: {
			toast: {
				id: '7',
				title: 'Processing...',
				description: 'Please wait while we process your request.',
				variant: 'default',
				dismissible: false,
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const AllVariants: Story = {
	render: () => ({
		props: {
			defaultToast: {
				id: 'default',
				title: 'Default Toast',
				description: 'This is a default toast notification.',
				variant: 'default',
				dismissible: true,
			},
			successToast: {
				id: 'success',
				title: 'Success Toast',
				description: 'This is a success toast notification.',
				variant: 'success',
				dismissible: true,
			},
			destructiveToast: {
				id: 'destructive',
				title: 'Destructive Toast',
				description: 'This is a destructive toast notification.',
				variant: 'destructive',
				dismissible: true,
			},
			warningToast: {
				id: 'warning',
				title: 'Warning Toast',
				description: 'This is a warning toast notification.',
				variant: 'warning',
				dismissible: true,
			},
		},
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 360px;">
				<mcms-toast [toast]="defaultToast" />
				<mcms-toast [toast]="successToast" />
				<mcms-toast [toast]="destructiveToast" />
				<mcms-toast [toast]="warningToast" />
			</div>
		`,
	}),
};

export const LongContent: Story = {
	render: () => ({
		props: {
			toast: {
				id: '8',
				title: 'Update Available',
				description:
					'A new version of the application is available. Please save your work and refresh the page to get the latest features and improvements.',
				variant: 'default',
				dismissible: true,
				action: {
					label: 'Refresh',
					onClick: () => console.warn('Refresh clicked'),
				},
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const SuccessWithAction: Story = {
	render: () => ({
		props: {
			toast: {
				id: '9',
				title: 'File Uploaded',
				description: 'Your file has been uploaded successfully.',
				variant: 'success',
				dismissible: true,
				action: {
					label: 'View',
					onClick: () => console.warn('View clicked'),
				},
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};

export const DestructiveWithAction: Story = {
	render: () => ({
		props: {
			toast: {
				id: '10',
				title: 'Item Deleted',
				description: 'The item has been moved to trash.',
				variant: 'destructive',
				dismissible: true,
				action: {
					label: 'Undo',
					onClick: () => console.warn('Undo clicked'),
				},
			},
		},
		template: `
			<div style="max-width: 360px;">
				<mcms-toast [toast]="toast" />
			</div>
		`,
	}),
};
