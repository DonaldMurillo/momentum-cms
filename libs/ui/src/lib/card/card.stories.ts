import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Card } from './card.component';
import { CardHeader } from './card-header.component';
import { CardTitle } from './card-title.component';
import { CardDescription } from './card-description.component';
import { CardContent } from './card-content.component';
import { CardFooter } from './card-footer.component';
import { Button } from '../button/button.component';
import { McmsFormField } from '../form-field/form-field.component';
import { Label } from '../label/label.component';
import { Input } from '../input/input.component';

const meta: Meta<Card> = {
	title: 'Components/Layout/Card',
	component: Card,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [
				Card,
				CardHeader,
				CardTitle,
				CardDescription,
				CardContent,
				CardFooter,
				Button,
				McmsFormField,
				Label,
				Input,
			],
		}),
	],
};
export default meta;
type Story = StoryObj<Card>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-card style="max-width: 350px;">
				<mcms-card-header>
					<mcms-card-title>Card Title</mcms-card-title>
					<mcms-card-description>Card description goes here.</mcms-card-description>
				</mcms-card-header>
				<mcms-card-content>
					<p>This is the main content of the card. You can put any content here.</p>
				</mcms-card-content>
				<mcms-card-footer>
					<button mcms-button>Action</button>
				</mcms-card-footer>
			</mcms-card>
		`,
	}),
};

export const Simple: Story = {
	render: () => ({
		template: `
			<mcms-card style="max-width: 350px;">
				<mcms-card-content>
					<p>A simple card with just content.</p>
				</mcms-card-content>
			</mcms-card>
		`,
	}),
};

export const WithForm: Story = {
	render: () => ({
		template: `
			<mcms-card style="max-width: 400px;">
				<mcms-card-header>
					<mcms-card-title>Create Account</mcms-card-title>
					<mcms-card-description>Enter your details to create a new account.</mcms-card-description>
				</mcms-card-header>
				<mcms-card-content>
					<div style="display: flex; flex-direction: column; gap: 1rem;">
						<mcms-form-field>
							<span mcmsLabel>Email</span>
							<mcms-input type="email" placeholder="Enter your email" />
						</mcms-form-field>
						<mcms-form-field>
							<span mcmsLabel>Password</span>
							<mcms-input type="password" placeholder="Enter password" />
						</mcms-form-field>
					</div>
				</mcms-card-content>
				<mcms-card-footer style="display: flex; justify-content: flex-end; gap: 0.5rem;">
					<button mcms-button variant="outline">Cancel</button>
					<button mcms-button variant="primary">Create</button>
				</mcms-card-footer>
			</mcms-card>
		`,
	}),
};

export const Notifications: Story = {
	render: () => ({
		template: `
			<mcms-card style="max-width: 400px;">
				<mcms-card-header>
					<mcms-card-title>Notifications</mcms-card-title>
					<mcms-card-description>You have 3 unread messages.</mcms-card-description>
				</mcms-card-header>
				<mcms-card-content>
					<div style="display: flex; flex-direction: column; gap: 1rem;">
						<div style="display: flex; gap: 0.75rem; align-items: flex-start;">
							<div style="width: 8px; height: 8px; border-radius: 50%; background: hsl(var(--mcms-primary)); margin-top: 6px;"></div>
							<div>
								<p style="font-weight: 500; font-size: 0.875rem;">New message from John</p>
								<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">2 minutes ago</p>
							</div>
						</div>
						<div style="display: flex; gap: 0.75rem; align-items: flex-start;">
							<div style="width: 8px; height: 8px; border-radius: 50%; background: hsl(var(--mcms-primary)); margin-top: 6px;"></div>
							<div>
								<p style="font-weight: 500; font-size: 0.875rem;">Comment on your post</p>
								<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">1 hour ago</p>
							</div>
						</div>
						<div style="display: flex; gap: 0.75rem; align-items: flex-start;">
							<div style="width: 8px; height: 8px; border-radius: 50%; background: hsl(var(--mcms-muted)); margin-top: 6px;"></div>
							<div>
								<p style="font-weight: 500; font-size: 0.875rem;">Weekly digest</p>
								<p style="font-size: 0.75rem; color: hsl(var(--mcms-muted-foreground));">Yesterday</p>
							</div>
						</div>
					</div>
				</mcms-card-content>
				<mcms-card-footer>
					<button mcms-button variant="outline" style="width: 100%;">View all</button>
				</mcms-card-footer>
			</mcms-card>
		`,
	}),
};

export const Multiple: Story = {
	render: () => ({
		template: `
			<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 900px;">
				<mcms-card>
					<mcms-card-header>
						<mcms-card-title>Card 1</mcms-card-title>
					</mcms-card-header>
					<mcms-card-content>
						<p>First card content.</p>
					</mcms-card-content>
				</mcms-card>
				<mcms-card>
					<mcms-card-header>
						<mcms-card-title>Card 2</mcms-card-title>
					</mcms-card-header>
					<mcms-card-content>
						<p>Second card content.</p>
					</mcms-card-content>
				</mcms-card>
				<mcms-card>
					<mcms-card-header>
						<mcms-card-title>Card 3</mcms-card-title>
					</mcms-card-header>
					<mcms-card-content>
						<p>Third card content.</p>
					</mcms-card-content>
				</mcms-card>
			</div>
		`,
	}),
};
