import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { Skeleton } from './skeleton.component';

const meta: Meta<Skeleton> = {
	title: 'Components/Skeleton',
	component: Skeleton,
	tags: ['autodocs'],
	decorators: [
		moduleMetadata({
			imports: [Skeleton],
		}),
	],
	argTypes: {
		class: {
			control: 'text',
			description: 'CSS classes for sizing and shape',
		},
	},
};
export default meta;
type Story = StoryObj<Skeleton>;

export const Default: Story = {
	args: {
		class: 'h-4 w-[200px]',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-skeleton [class]="class" />`,
	}),
};

export const Circle: Story = {
	args: {
		class: 'h-12 w-12 rounded-full',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-skeleton [class]="class" />`,
	}),
};

export const Rectangle: Story = {
	args: {
		class: 'h-32 w-full',
	},
	render: (args) => ({
		props: args,
		template: `<mcms-skeleton [class]="class" />`,
	}),
};

export const CardSkeleton: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem; max-width: 350px;">
				<mcms-skeleton class="h-[200px] w-full rounded-lg" />
				<div style="display: flex; flex-direction: column; gap: 0.5rem;">
					<mcms-skeleton class="h-4 w-3/4" />
					<mcms-skeleton class="h-4 w-1/2" />
				</div>
			</div>
		`,
	}),
};

export const ListSkeleton: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 1rem;">
				@for (i of [1, 2, 3]; track i) {
					<div style="display: flex; gap: 1rem; align-items: center;">
						<mcms-skeleton class="h-10 w-10 rounded-full" />
						<div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1;">
							<mcms-skeleton class="h-4 w-1/3" />
							<mcms-skeleton class="h-3 w-2/3" />
						</div>
					</div>
				}
			</div>
		`,
	}),
};

export const TextSkeleton: Story = {
	render: () => ({
		template: `
			<div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 400px;">
				<mcms-skeleton class="h-4 w-full" />
				<mcms-skeleton class="h-4 w-5/6" />
				<mcms-skeleton class="h-4 w-4/5" />
				<mcms-skeleton class="h-4 w-3/4" />
			</div>
		`,
	}),
};
