import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Accordion } from './accordion.component';
import { AccordionItem } from './accordion-item.component';
import { AccordionTrigger } from './accordion-trigger.component';
import { AccordionContent } from './accordion-content.component';

const meta: Meta<Accordion> = {
	title: 'Components/Navigation/Accordion',
	component: Accordion,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Accordion, AccordionItem, AccordionTrigger, AccordionContent],
		}),
	],
	argTypes: {
		multiExpandable: {
			control: 'boolean',
			description: 'Whether multiple items can be expanded at once',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether the accordion is disabled',
		},
	},
};
export default meta;
type Story = StoryObj<Accordion>;

export const Default: Story = {
	render: () => ({
		template: `
			<mcms-accordion style="max-width: 500px;">
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="item-1">Is it accessible?</mcms-accordion-trigger>
					<mcms-accordion-content panelId="item-1">
						Yes. It adheres to the WAI-ARIA design pattern.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="item-2">Is it styled?</mcms-accordion-trigger>
					<mcms-accordion-content panelId="item-2">
						Yes. It comes with default styles that matches the other components' aesthetic.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="item-3">Is it animated?</mcms-accordion-trigger>
					<mcms-accordion-content panelId="item-3">
						Yes. It's animated by default, but you can disable it if you prefer.
					</mcms-accordion-content>
				</mcms-accordion-item>
			</mcms-accordion>
		`,
	}),
};

export const MultiExpandable: Story = {
	args: {
		multiExpandable: true,
	},
	render: (args) => ({
		props: args,
		template: `
			<mcms-accordion [multiExpandable]="multiExpandable" style="max-width: 500px;">
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="multi-1">Section 1</mcms-accordion-trigger>
					<mcms-accordion-content panelId="multi-1">
						Content for section 1. You can expand multiple sections at once.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="multi-2">Section 2</mcms-accordion-trigger>
					<mcms-accordion-content panelId="multi-2">
						Content for section 2. Try expanding this while section 1 is open.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="multi-3">Section 3</mcms-accordion-trigger>
					<mcms-accordion-content panelId="multi-3">
						Content for section 3. All three can be open simultaneously.
					</mcms-accordion-content>
				</mcms-accordion-item>
			</mcms-accordion>
		`,
	}),
};

export const WithDisabledItem: Story = {
	render: () => ({
		template: `
			<mcms-accordion style="max-width: 500px;">
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="dis-1">Available Section</mcms-accordion-trigger>
					<mcms-accordion-content panelId="dis-1">
						This section is available for interaction.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="dis-2" [disabled]="true">Disabled Section</mcms-accordion-trigger>
					<mcms-accordion-content panelId="dis-2">
						You won't see this content because the trigger is disabled.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="dis-3">Another Available Section</mcms-accordion-trigger>
					<mcms-accordion-content panelId="dis-3">
						This section is also available.
					</mcms-accordion-content>
				</mcms-accordion-item>
			</mcms-accordion>
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
			<mcms-accordion [disabled]="disabled" style="max-width: 500px;">
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="all-dis-1">Section 1</mcms-accordion-trigger>
					<mcms-accordion-content panelId="all-dis-1">Content 1</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="all-dis-2">Section 2</mcms-accordion-trigger>
					<mcms-accordion-content panelId="all-dis-2">Content 2</mcms-accordion-content>
				</mcms-accordion-item>
			</mcms-accordion>
		`,
	}),
};

export const FAQ: Story = {
	render: () => ({
		template: `
			<mcms-accordion style="max-width: 600px;">
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="faq-1">What payment methods do you accept?</mcms-accordion-trigger>
					<mcms-accordion-content panelId="faq-1">
						We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers.
						For enterprise customers, we also offer invoicing options.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="faq-2">How do I cancel my subscription?</mcms-accordion-trigger>
					<mcms-accordion-content panelId="faq-2">
						You can cancel your subscription at any time from your account settings.
						Go to Settings > Billing > Cancel Subscription. Your access will continue until the end of your billing period.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="faq-3">Do you offer refunds?</mcms-accordion-trigger>
					<mcms-accordion-content panelId="faq-3">
						Yes, we offer a 30-day money-back guarantee for all new subscriptions.
						If you're not satisfied, contact our support team for a full refund.
					</mcms-accordion-content>
				</mcms-accordion-item>
				<mcms-accordion-item>
					<mcms-accordion-trigger panelId="faq-4">Is there a free trial?</mcms-accordion-trigger>
					<mcms-accordion-content panelId="faq-4">
						Yes! We offer a 14-day free trial for all plans. No credit card required to start.
					</mcms-accordion-content>
				</mcms-accordion-item>
			</mcms-accordion>
		`,
	}),
};
