import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Tabs } from './tabs.component';
import { TabsList } from './tabs-list.component';
import { TabsTrigger } from './tabs-trigger.component';
import { TabsContent } from './tabs-content.component';
import { Card } from '../card/card.component';
import { CardHeader } from '../card/card-header.component';
import { CardTitle } from '../card/card-title.component';
import { CardDescription } from '../card/card-description.component';
import { CardContent } from '../card/card-content.component';
import { CardFooter } from '../card/card-footer.component';
import { McmsFormField } from '../form-field/form-field.component';
import { Input } from '../input/input.component';
import { Button } from '../button/button.component';
import { Label } from '../label/label.component';

const meta: Meta<Tabs> = {
	title: 'Components/Navigation/Tabs',
	component: Tabs,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [
				Tabs,
				TabsList,
				TabsTrigger,
				TabsContent,
				Card,
				CardHeader,
				CardTitle,
				CardDescription,
				CardContent,
				CardFooter,
				McmsFormField,
				Input,
				Button,
				Label,
			],
		}),
	],
};
export default meta;
type Story = StoryObj<Tabs>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-tabs>
				<mcms-tabs-list>
					<mcms-tabs-trigger value="account">Account</mcms-tabs-trigger>
					<mcms-tabs-trigger value="password">Password</mcms-tabs-trigger>
				</mcms-tabs-list>
				<mcms-tabs-content value="account">
					<div style="padding: 1rem;">
						<h3 style="font-weight: 500; margin-bottom: 0.5rem;">Account Settings</h3>
						<p style="color: hsl(var(--mcms-muted-foreground)); font-size: 0.875rem;">
							Make changes to your account here. Click save when you're done.
						</p>
					</div>
				</mcms-tabs-content>
				<mcms-tabs-content value="password">
					<div style="padding: 1rem;">
						<h3 style="font-weight: 500; margin-bottom: 0.5rem;">Change Password</h3>
						<p style="color: hsl(var(--mcms-muted-foreground)); font-size: 0.875rem;">
							Change your password here. After saving, you'll be logged out.
						</p>
					</div>
				</mcms-tabs-content>
			</mcms-tabs>
		`,
	}),
};

export const ThreeTabs: Story = {
	render: () => ({
		template: `
			<mcms-tabs>
				<mcms-tabs-list>
					<mcms-tabs-trigger value="overview">Overview</mcms-tabs-trigger>
					<mcms-tabs-trigger value="analytics">Analytics</mcms-tabs-trigger>
					<mcms-tabs-trigger value="reports">Reports</mcms-tabs-trigger>
				</mcms-tabs-list>
				<mcms-tabs-content value="overview">
					<div style="padding: 1rem;">Overview content</div>
				</mcms-tabs-content>
				<mcms-tabs-content value="analytics">
					<div style="padding: 1rem;">Analytics content</div>
				</mcms-tabs-content>
				<mcms-tabs-content value="reports">
					<div style="padding: 1rem;">Reports content</div>
				</mcms-tabs-content>
			</mcms-tabs>
		`,
	}),
};

export const WithDisabledTab: Story = {
	render: () => ({
		template: `
			<mcms-tabs>
				<mcms-tabs-list>
					<mcms-tabs-trigger value="active">Active</mcms-tabs-trigger>
					<mcms-tabs-trigger value="disabled" [disabled]="true">Disabled</mcms-tabs-trigger>
					<mcms-tabs-trigger value="another">Another</mcms-tabs-trigger>
				</mcms-tabs-list>
				<mcms-tabs-content value="active">
					<div style="padding: 1rem;">Active tab content</div>
				</mcms-tabs-content>
				<mcms-tabs-content value="another">
					<div style="padding: 1rem;">Another tab content</div>
				</mcms-tabs-content>
			</mcms-tabs>
		`,
	}),
};

export const WithCards: Story = {
	render: () => ({
		template: `
			<mcms-tabs style="max-width: 400px;">
				<mcms-tabs-list>
					<mcms-tabs-trigger value="account">Account</mcms-tabs-trigger>
					<mcms-tabs-trigger value="password">Password</mcms-tabs-trigger>
				</mcms-tabs-list>
				<mcms-tabs-content value="account">
					<mcms-card style="margin-top: 0.5rem;">
						<mcms-card-header>
							<mcms-card-title>Account</mcms-card-title>
							<mcms-card-description>Make changes to your account.</mcms-card-description>
						</mcms-card-header>
						<mcms-card-content>
							<mcms-form-field>
								<span mcmsLabel>Name</span>
								<mcms-input placeholder="Enter your name" />
							</mcms-form-field>
						</mcms-card-content>
						<mcms-card-footer>
							<button mcms-button variant="primary">Save changes</button>
						</mcms-card-footer>
					</mcms-card>
				</mcms-tabs-content>
				<mcms-tabs-content value="password">
					<mcms-card style="margin-top: 0.5rem;">
						<mcms-card-header>
							<mcms-card-title>Password</mcms-card-title>
							<mcms-card-description>Change your password.</mcms-card-description>
						</mcms-card-header>
						<mcms-card-content>
							<mcms-form-field>
								<span mcmsLabel>New Password</span>
								<mcms-input type="password" placeholder="Enter new password" />
							</mcms-form-field>
						</mcms-card-content>
						<mcms-card-footer>
							<button mcms-button variant="primary">Update password</button>
						</mcms-card-footer>
					</mcms-card>
				</mcms-tabs-content>
			</mcms-tabs>
		`,
	}),
};

export const ManyTabs: Story = {
	render: () => ({
		template: `
			<mcms-tabs>
				<mcms-tabs-list>
					<mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
					<mcms-tabs-trigger value="tab2">Tab 2</mcms-tabs-trigger>
					<mcms-tabs-trigger value="tab3">Tab 3</mcms-tabs-trigger>
					<mcms-tabs-trigger value="tab4">Tab 4</mcms-tabs-trigger>
					<mcms-tabs-trigger value="tab5">Tab 5</mcms-tabs-trigger>
					<mcms-tabs-trigger value="tab6">Tab 6</mcms-tabs-trigger>
				</mcms-tabs-list>
				<mcms-tabs-content value="tab1"><div style="padding: 1rem;">Content 1</div></mcms-tabs-content>
				<mcms-tabs-content value="tab2"><div style="padding: 1rem;">Content 2</div></mcms-tabs-content>
				<mcms-tabs-content value="tab3"><div style="padding: 1rem;">Content 3</div></mcms-tabs-content>
				<mcms-tabs-content value="tab4"><div style="padding: 1rem;">Content 4</div></mcms-tabs-content>
				<mcms-tabs-content value="tab5"><div style="padding: 1rem;">Content 5</div></mcms-tabs-content>
				<mcms-tabs-content value="tab6"><div style="padding: 1rem;">Content 6</div></mcms-tabs-content>
			</mcms-tabs>
		`,
	}),
};
