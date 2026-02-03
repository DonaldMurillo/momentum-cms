import type { Meta, StoryObj } from '@storybook/angular';
import { AspectRatio } from './aspect-ratio.component';

const meta: Meta<AspectRatio> = {
	title: 'Components/Layout/AspectRatio',
	component: AspectRatio,
	tags: ['autodocs'],
	argTypes: {
		ratio: {
			control: 'number',
			description: 'The aspect ratio (width/height)',
		},
	},
};
export default meta;
type Story = StoryObj<AspectRatio>;

export const Default: Story = {
	args: {
		ratio: 16 / 9,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 400px;">
				<mcms-aspect-ratio [ratio]="ratio">
					<div style="width: 100%; height: 100%; background: linear-gradient(135deg, hsl(var(--mcms-primary)) 0%, hsl(var(--mcms-accent)) 100%); border-radius: 0.375rem; display: flex; align-items: center; justify-content: center; color: white; font-weight: 500;">
						16:9
					</div>
				</mcms-aspect-ratio>
			</div>
		`,
	}),
};

export const Square: Story = {
	args: {
		ratio: 1,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 200px;">
				<mcms-aspect-ratio [ratio]="ratio">
					<div style="width: 100%; height: 100%; background: hsl(var(--mcms-secondary)); border-radius: 0.375rem; display: flex; align-items: center; justify-content: center;">
						1:1
					</div>
				</mcms-aspect-ratio>
			</div>
		`,
	}),
};

export const Portrait: Story = {
	args: {
		ratio: 3 / 4,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 200px;">
				<mcms-aspect-ratio [ratio]="ratio">
					<div style="width: 100%; height: 100%; background: hsl(var(--mcms-muted)); border-radius: 0.375rem; display: flex; align-items: center; justify-content: center;">
						3:4
					</div>
				</mcms-aspect-ratio>
			</div>
		`,
	}),
};

export const Ultrawide: Story = {
	args: {
		ratio: 21 / 9,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 600px;">
				<mcms-aspect-ratio [ratio]="ratio">
					<div style="width: 100%; height: 100%; background: linear-gradient(90deg, hsl(var(--mcms-destructive)) 0%, hsl(var(--mcms-warning)) 50%, hsl(var(--mcms-success)) 100%); border-radius: 0.375rem; display: flex; align-items: center; justify-content: center; color: white; font-weight: 500;">
						21:9
					</div>
				</mcms-aspect-ratio>
			</div>
		`,
	}),
};

export const WithImage: Story = {
	args: {
		ratio: 16 / 9,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 400px;">
				<mcms-aspect-ratio [ratio]="ratio">
					<img
						src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"
						alt="Mountain landscape"
						style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.375rem;"
					/>
				</mcms-aspect-ratio>
			</div>
		`,
	}),
};

export const VideoPlaceholder: Story = {
	args: {
		ratio: 16 / 9,
	},
	render: (args) => ({
		props: args,
		template: `
			<div style="max-width: 500px;">
				<mcms-aspect-ratio [ratio]="ratio">
					<div style="width: 100%; height: 100%; background: #000; border-radius: 0.375rem; display: flex; align-items: center; justify-content: center;">
						<svg width="64" height="64" viewBox="0 0 24 24" fill="white">
							<polygon points="5 3 19 12 5 21 5 3"/>
						</svg>
					</div>
				</mcms-aspect-ratio>
			</div>
		`,
	}),
};

export const AllRatios: Story = {
	render: () => ({
		template: `
			<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
				<div>
					<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: hsl(var(--mcms-muted-foreground));">1:1 (Square)</p>
					<mcms-aspect-ratio [ratio]="1">
						<div style="width: 100%; height: 100%; background: hsl(var(--mcms-primary) / 0.2); border-radius: 0.375rem;"></div>
					</mcms-aspect-ratio>
				</div>
				<div>
					<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: hsl(var(--mcms-muted-foreground));">4:3</p>
					<mcms-aspect-ratio [ratio]="4/3">
						<div style="width: 100%; height: 100%; background: hsl(var(--mcms-success) / 0.2); border-radius: 0.375rem;"></div>
					</mcms-aspect-ratio>
				</div>
				<div>
					<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: hsl(var(--mcms-muted-foreground));">16:9</p>
					<mcms-aspect-ratio [ratio]="16/9">
						<div style="width: 100%; height: 100%; background: hsl(var(--mcms-warning) / 0.2); border-radius: 0.375rem;"></div>
					</mcms-aspect-ratio>
				</div>
				<div>
					<p style="font-size: 0.875rem; margin-bottom: 0.5rem; color: hsl(var(--mcms-muted-foreground));">3:4 (Portrait)</p>
					<mcms-aspect-ratio [ratio]="3/4">
						<div style="width: 100%; height: 100%; background: hsl(var(--mcms-destructive) / 0.2); border-radius: 0.375rem;"></div>
					</mcms-aspect-ratio>
				</div>
			</div>
		`,
	}),
};
