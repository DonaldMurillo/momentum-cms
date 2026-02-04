import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Avatar } from './avatar.component';
import { AvatarFallback } from './avatar-fallback.component';
import { AvatarImage } from './avatar-image.component';

const meta: Meta<Avatar> = {
	title: 'Components/Data/Avatar',
	component: Avatar,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Avatar, AvatarFallback, AvatarImage],
		}),
	],
	argTypes: {
		size: {
			control: 'select',
			options: ['xs', 'sm', 'md', 'lg', 'xl'],
			description: 'Size of the avatar',
		},
	},
};
export default meta;
type Story = StoryObj<Avatar>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-avatar>
				<mcms-avatar-fallback>JD</mcms-avatar-fallback>
			</mcms-avatar>
		`,
	}),
};

export const WithImage: Story = {
	render: () => ({
		template: `
			<mcms-avatar>
				<mcms-avatar-image src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" alt="User" />
				<mcms-avatar-fallback>JD</mcms-avatar-fallback>
			</mcms-avatar>
		`,
	}),
};

export const AllSizes: Story = {
	render: () => ({
		template: `
			<div style="display: flex; align-items: center; gap: 1rem;">
				<div style="text-align: center;">
					<mcms-avatar size="xs">
						<mcms-avatar-fallback>XS</mcms-avatar-fallback>
					</mcms-avatar>
					<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); margin-top: 0.5rem;">xs</p>
				</div>
				<div style="text-align: center;">
					<mcms-avatar size="sm">
						<mcms-avatar-fallback>SM</mcms-avatar-fallback>
					</mcms-avatar>
					<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); margin-top: 0.5rem;">sm</p>
				</div>
				<div style="text-align: center;">
					<mcms-avatar size="md">
						<mcms-avatar-fallback>MD</mcms-avatar-fallback>
					</mcms-avatar>
					<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); margin-top: 0.5rem;">md</p>
				</div>
				<div style="text-align: center;">
					<mcms-avatar size="lg">
						<mcms-avatar-fallback>LG</mcms-avatar-fallback>
					</mcms-avatar>
					<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); margin-top: 0.5rem;">lg</p>
				</div>
				<div style="text-align: center;">
					<mcms-avatar size="xl">
						<mcms-avatar-fallback>XL</mcms-avatar-fallback>
					</mcms-avatar>
					<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground)); margin-top: 0.5rem;">xl</p>
				</div>
			</div>
		`,
	}),
};

export const FallbackVariants: Story = {
	render: () => ({
		template: `
			<div style="display: flex; gap: 1rem;">
				<mcms-avatar>
					<mcms-avatar-fallback>JD</mcms-avatar-fallback>
				</mcms-avatar>
				<mcms-avatar>
					<mcms-avatar-fallback>AB</mcms-avatar-fallback>
				</mcms-avatar>
				<mcms-avatar>
					<mcms-avatar-fallback>CD</mcms-avatar-fallback>
				</mcms-avatar>
				<mcms-avatar>
					<mcms-avatar-fallback>?</mcms-avatar-fallback>
				</mcms-avatar>
			</div>
		`,
	}),
};

export const AvatarGroup: Story = {
	render: () => ({
		template: `
			<div style="display: flex;">
				<mcms-avatar style="border: 2px solid hsl(var(--mcms-background));">
					<mcms-avatar-fallback>JD</mcms-avatar-fallback>
				</mcms-avatar>
				<mcms-avatar style="margin-left: -0.75rem; border: 2px solid hsl(var(--mcms-background));">
					<mcms-avatar-fallback>AB</mcms-avatar-fallback>
				</mcms-avatar>
				<mcms-avatar style="margin-left: -0.75rem; border: 2px solid hsl(var(--mcms-background));">
					<mcms-avatar-fallback>CD</mcms-avatar-fallback>
				</mcms-avatar>
				<mcms-avatar style="margin-left: -0.75rem; border: 2px solid hsl(var(--mcms-background));">
					<mcms-avatar-fallback>EF</mcms-avatar-fallback>
				</mcms-avatar>
				<mcms-avatar style="margin-left: -0.75rem; border: 2px solid hsl(var(--mcms-background));">
					<mcms-avatar-fallback>+3</mcms-avatar-fallback>
				</mcms-avatar>
			</div>
		`,
	}),
};

export const WithStatusIndicator: Story = {
	render: () => ({
		template: `
			<div style="display: flex; gap: 1.5rem;">
				<div style="position: relative;">
					<mcms-avatar>
						<mcms-avatar-fallback>JD</mcms-avatar-fallback>
					</mcms-avatar>
					<span style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: hsl(var(--mcms-success)); border: 2px solid hsl(var(--mcms-background)); border-radius: 9999px;"></span>
				</div>
				<div style="position: relative;">
					<mcms-avatar>
						<mcms-avatar-fallback>AB</mcms-avatar-fallback>
					</mcms-avatar>
					<span style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: hsl(var(--mcms-warning)); border: 2px solid hsl(var(--mcms-background)); border-radius: 9999px;"></span>
				</div>
				<div style="position: relative;">
					<mcms-avatar>
						<mcms-avatar-fallback>CD</mcms-avatar-fallback>
					</mcms-avatar>
					<span style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: hsl(var(--mcms-muted-foreground)); border: 2px solid hsl(var(--mcms-background)); border-radius: 9999px;"></span>
				</div>
			</div>
		`,
	}),
};

export const UserCard: Story = {
	render: () => ({
		template: `
			<div style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border: 1px solid hsl(var(--mcms-border)); border-radius: 0.5rem; max-width: 300px;">
				<mcms-avatar>
					<mcms-avatar-image src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop" alt="John Doe" />
					<mcms-avatar-fallback>JD</mcms-avatar-fallback>
				</mcms-avatar>
				<div>
					<div style="font-weight: 500;">John Doe</div>
					<div style="font-size: 0.875rem; color: hsl(var(--mcms-muted-foreground));">john@example.com</div>
				</div>
			</div>
		`,
	}),
};

export const LargeProfile: Story = {
	render: () => ({
		template: `
			<div style="text-align: center;">
				<mcms-avatar size="xl">
					<mcms-avatar-image src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop" alt="John Doe" />
					<mcms-avatar-fallback>JD</mcms-avatar-fallback>
				</mcms-avatar>
				<h3 style="margin-top: 1rem; font-weight: 600;">John Doe</h3>
				<p style="color: hsl(var(--mcms-muted-foreground)); font-size: 0.875rem;">Software Engineer</p>
			</div>
		`,
	}),
};
