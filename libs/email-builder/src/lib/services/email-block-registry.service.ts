import { Injectable, InjectionToken, inject, type Provider } from '@angular/core';
import type { EmailBlockDefinition } from '@momentumcms/email';

/**
 * Token for providing email block definitions.
 * Multiple providers can contribute blocks using multi: true.
 */
export const EMAIL_BLOCK_DEFINITIONS = new InjectionToken<EmailBlockDefinition[][]>(
	'EMAIL_BLOCK_DEFINITIONS',
);

/**
 * Registry service that collects all registered block definitions
 * and provides lookup utilities for the builder.
 */
@Injectable()
export class EmailBlockRegistryService {
	private readonly definitionSets = inject(EMAIL_BLOCK_DEFINITIONS, { optional: true }) ?? [];

	/** All registered block definitions, flattened from multi-providers. */
	readonly definitions: EmailBlockDefinition[] = this.definitionSets.flat();

	/** Map of slug → definition for fast lookup. */
	private readonly slugMap = new Map<string, EmailBlockDefinition>(
		this.definitions.map((d) => [d.slug, d]),
	);

	/** Get a block definition by slug. */
	get(slug: string): EmailBlockDefinition | undefined {
		return this.slugMap.get(slug);
	}

	/** Check if a block type is registered. */
	has(slug: string): boolean {
		return this.slugMap.has(slug);
	}
}

/**
 * Default block definitions for the built-in email block types.
 */
export const DEFAULT_EMAIL_BLOCK_DEFINITIONS: EmailBlockDefinition[] = [
	{
		slug: 'header',
		label: 'Header',
		icon: 'heading',
		fields: [
			{ name: 'title', label: 'Title', type: 'text', required: true, defaultValue: 'Heading' },
			{ name: 'subtitle', label: 'Subtitle', type: 'text' },
			{
				name: 'alignment',
				label: 'Alignment',
				type: 'select',
				defaultValue: 'left',
				options: [
					{ label: 'Left', value: 'left' },
					{ label: 'Center', value: 'center' },
					{ label: 'Right', value: 'right' },
				],
			},
		],
		defaultData: { title: 'Heading', alignment: 'left' },
	},
	{
		slug: 'text',
		label: 'Text',
		icon: 'text',
		fields: [
			{
				name: 'content',
				label: 'Content',
				type: 'textarea',
				required: true,
				defaultValue: 'Your text here...',
			},
			{ name: 'fontSize', label: 'Font Size', type: 'number', defaultValue: 16 },
			{ name: 'color', label: 'Text Color', type: 'color' },
			{
				name: 'alignment',
				label: 'Alignment',
				type: 'select',
				defaultValue: 'left',
				options: [
					{ label: 'Left', value: 'left' },
					{ label: 'Center', value: 'center' },
					{ label: 'Right', value: 'right' },
				],
			},
		],
		defaultData: { content: 'Your text here...', fontSize: 16, alignment: 'left' },
	},
	{
		slug: 'button',
		label: 'Button',
		icon: 'pointer',
		fields: [
			{
				name: 'label',
				label: 'Label',
				type: 'text',
				required: true,
				defaultValue: 'Click here',
			},
			{ name: 'href', label: 'URL', type: 'url', required: true, defaultValue: '#' },
			{ name: 'backgroundColor', label: 'Background', type: 'color', defaultValue: '#18181b' },
			{ name: 'color', label: 'Text Color', type: 'color', defaultValue: '#ffffff' },
			{
				name: 'alignment',
				label: 'Alignment',
				type: 'select',
				defaultValue: 'left',
				options: [
					{ label: 'Left', value: 'left' },
					{ label: 'Center', value: 'center' },
					{ label: 'Right', value: 'right' },
				],
			},
		],
		defaultData: {
			label: 'Click here',
			href: '#',
			backgroundColor: '#18181b',
			color: '#ffffff',
			alignment: 'left',
		},
	},
	{
		slug: 'image',
		label: 'Image',
		icon: 'image',
		fields: [
			{ name: 'src', label: 'Image URL', type: 'url', required: true },
			{ name: 'alt', label: 'Alt Text', type: 'text', required: true },
			{ name: 'width', label: 'Width', type: 'text', defaultValue: '100%' },
			{ name: 'href', label: 'Link URL', type: 'url' },
		],
		defaultData: { src: '', alt: '', width: '100%' },
	},
	{
		slug: 'divider',
		label: 'Divider',
		icon: 'minus',
		fields: [
			{ name: 'color', label: 'Color', type: 'color', defaultValue: '#e4e4e7' },
			{ name: 'margin', label: 'Margin', type: 'text', defaultValue: '24px 0' },
		],
		defaultData: { color: '#e4e4e7', margin: '24px 0' },
	},
	{
		slug: 'spacer',
		label: 'Spacer',
		icon: 'space',
		fields: [{ name: 'height', label: 'Height (px)', type: 'number', defaultValue: 24 }],
		defaultData: { height: 24 },
	},
	{
		slug: 'columns',
		label: 'Columns',
		icon: 'columns',
		fields: [
			{
				name: 'columns',
				label: 'Columns',
				type: 'blocks',
				defaultValue: [{ blocks: [] }, { blocks: [] }],
			},
		],
		defaultData: { columns: [{ blocks: [] }, { blocks: [] }] },
	},
	{
		slug: 'footer',
		label: 'Footer',
		icon: 'footer',
		fields: [
			{
				name: 'text',
				label: 'Footer Text',
				type: 'textarea',
				required: true,
				defaultValue: 'You received this email because...',
			},
			{ name: 'color', label: 'Text Color', type: 'color' },
		],
		defaultData: { text: 'You received this email because...' },
	},
];

/**
 * Register email block definitions for the builder.
 *
 * @example
 * ```typescript
 * // Register default blocks:
 * provideEmailBlocks(DEFAULT_EMAIL_BLOCK_DEFINITIONS)
 *
 * // Register custom blocks alongside defaults:
 * provideEmailBlocks([...DEFAULT_EMAIL_BLOCK_DEFINITIONS, myCustomBlock])
 * ```
 */
export function provideEmailBlocks(definitions: EmailBlockDefinition[]): Provider {
	return {
		provide: EMAIL_BLOCK_DEFINITIONS,
		useValue: definitions,
		multi: true,
	};
}
