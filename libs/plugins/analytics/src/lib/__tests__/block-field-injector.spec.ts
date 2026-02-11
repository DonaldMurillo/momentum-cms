import { describe, it, expect } from 'vitest';
import { injectBlockAnalyticsFields } from '../collectors/block-field-injector';
import type { CollectionConfig, Field } from '@momentum-cms/core';

function makeBlockField(blocks: Array<{ slug: string; fields: Field[] }>): Field {
	return {
		type: 'blocks',
		name: 'layout',
		blocks: blocks.map((b) => ({ ...b, fields: [...b.fields] })),
	} as unknown as Field;
}

function makeCollection(fields: Field[]): CollectionConfig {
	return { slug: 'pages', fields } as CollectionConfig;
}

describe('injectBlockAnalyticsFields', () => {
	it('should inject _analytics group into each block definition', () => {
		const hero = { slug: 'hero', fields: [] };
		const cta = { slug: 'cta', fields: [] };
		const collections = [makeCollection([makeBlockField([hero, cta])])];

		injectBlockAnalyticsFields(collections);

		const blocksField = collections[0].fields[0] as unknown as {
			blocks: Array<{ fields: Field[] }>;
		};
		expect(blocksField.blocks[0].fields).toHaveLength(1);
		expect(blocksField.blocks[0].fields[0].name).toBe('_analytics');
		expect(blocksField.blocks[0].fields[0].type).toBe('group');

		expect(blocksField.blocks[1].fields).toHaveLength(1);
		expect(blocksField.blocks[1].fields[0].name).toBe('_analytics');
	});

	it('should be idempotent — calling twice does not duplicate fields', () => {
		const hero = { slug: 'hero', fields: [] };
		const collections = [makeCollection([makeBlockField([hero])])];

		injectBlockAnalyticsFields(collections);
		injectBlockAnalyticsFields(collections);

		const blocksField = collections[0].fields[0] as unknown as {
			blocks: Array<{ fields: Field[] }>;
		};
		const analyticsFields = blocksField.blocks[0].fields.filter((f) => f.name === '_analytics');
		expect(analyticsFields).toHaveLength(1);
	});

	it('should handle collections with no block fields', () => {
		const collections = [makeCollection([{ type: 'text', name: 'title' } as unknown as Field])];

		// Should not throw
		injectBlockAnalyticsFields(collections);

		expect(collections[0].fields).toHaveLength(1);
		expect(collections[0].fields[0].name).toBe('title');
	});

	it('should handle empty collections array', () => {
		const collections: CollectionConfig[] = [];
		// Should not throw
		injectBlockAnalyticsFields(collections);
		expect(collections).toHaveLength(0);
	});

	it('should recurse into group fields to find nested blocks', () => {
		const hero = { slug: 'hero', fields: [] };
		const groupField = {
			type: 'group',
			name: 'content',
			fields: [makeBlockField([hero])],
		} as unknown as Field;
		const collections = [makeCollection([groupField])];

		injectBlockAnalyticsFields(collections);

		const group = collections[0].fields[0] as unknown as { fields: Field[] };
		const blocksField = group.fields[0] as unknown as {
			blocks: Array<{ fields: Field[] }>;
		};
		expect(blocksField.blocks[0].fields).toHaveLength(1);
		expect(blocksField.blocks[0].fields[0].name).toBe('_analytics');
	});

	it('should recurse into array fields to find nested blocks', () => {
		const hero = { slug: 'hero', fields: [] };
		const arrayField = {
			type: 'array',
			name: 'sections',
			fields: [makeBlockField([hero])],
		} as unknown as Field;
		const collections = [makeCollection([arrayField])];

		injectBlockAnalyticsFields(collections);

		const arr = collections[0].fields[0] as unknown as { fields: Field[] };
		const blocksField = arr.fields[0] as unknown as {
			blocks: Array<{ fields: Field[] }>;
		};
		expect(blocksField.blocks[0].fields).toHaveLength(1);
		expect(blocksField.blocks[0].fields[0].name).toBe('_analytics');
	});

	it('should recurse into tabs fields to find nested blocks', () => {
		const hero = { slug: 'hero', fields: [] };
		const tabsField = {
			type: 'tabs',
			name: 'tabs',
			tabs: [{ label: 'Content', fields: [makeBlockField([hero])] }],
		} as unknown as Field;
		const collections = [makeCollection([tabsField])];

		injectBlockAnalyticsFields(collections);

		const tabs = collections[0].fields[0] as unknown as {
			tabs: Array<{ fields: Field[] }>;
		};
		const blocksField = tabs.tabs[0].fields[0] as unknown as {
			blocks: Array<{ fields: Field[] }>;
		};
		expect(blocksField.blocks[0].fields).toHaveLength(1);
		expect(blocksField.blocks[0].fields[0].name).toBe('_analytics');
	});

	it('should inject into multiple collections', () => {
		const hero = { slug: 'hero', fields: [] };
		const collections = [
			makeCollection([makeBlockField([hero])]),
			{
				slug: 'posts',
				fields: [makeBlockField([{ slug: 'text', fields: [] }])],
			} as CollectionConfig,
		];

		injectBlockAnalyticsFields(collections);

		for (const col of collections) {
			const blocksField = col.fields[0] as unknown as {
				blocks: Array<{ fields: Field[] }>;
			};
			expect(blocksField.blocks[0].fields.some((f) => f.name === '_analytics')).toBe(true);
		}
	});

	it('should inject _analytics with trackImpressions and trackHover checkboxes', () => {
		const hero = { slug: 'hero', fields: [] };
		const collections = [makeCollection([makeBlockField([hero])])];

		injectBlockAnalyticsFields(collections);

		const blocksField = collections[0].fields[0] as unknown as {
			blocks: Array<{ fields: Field[] }>;
		};
		const analyticsGroup = blocksField.blocks[0].fields[0] as unknown as {
			name: string;
			type: string;
			fields: Field[];
			admin?: { collapsible?: boolean; defaultOpen?: boolean };
		};
		expect(analyticsGroup.name).toBe('_analytics');
		expect(analyticsGroup.type).toBe('group');
		expect(analyticsGroup.fields).toHaveLength(2);
		expect(analyticsGroup.fields[0].name).toBe('trackImpressions');
		expect(analyticsGroup.fields[1].name).toBe('trackHover');
		expect(analyticsGroup.admin?.collapsible).toBe(true);
		expect(analyticsGroup.admin?.defaultOpen).toBe(false);
	});
});
