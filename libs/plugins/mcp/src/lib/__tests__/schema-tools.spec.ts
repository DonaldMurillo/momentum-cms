import { describe, it, expect } from 'vitest';
import { handleListCollections, handleGetCollectionSchema } from '../tools/schema-tools';
import type { CollectionConfig } from '@momentumcms/core';
import type { MomentumConfig } from '@momentumcms/core';

function makeCollection(slug: string, opts?: Partial<CollectionConfig>): CollectionConfig {
	return {
		slug,
		fields: [{ name: 'title', type: 'text' }],
		labels: { singular: slug, plural: slug.charAt(0).toUpperCase() + slug.slice(1) },
		...opts,
	} as unknown as CollectionConfig;
}

function makeConfig(collections: CollectionConfig[]): MomentumConfig {
	return { collections, globals: [] } as unknown as MomentumConfig;
}

const allowAll = () => true;
const allowNone = () => false;

describe('handleListCollections', () => {
	it('should list all allowed collections', () => {
		const config = makeConfig([makeCollection('posts'), makeCollection('products')]);
		const result = handleListCollections(config, allowAll);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toHaveLength(2);
		expect(parsed[0].slug).toBe('posts');
		expect(parsed[1].slug).toBe('products');
	});

	it('should filter out denied collections', () => {
		const config = makeConfig([makeCollection('posts'), makeCollection('secrets')]);
		const filter = (slug: string) => slug !== 'secrets';
		const result = handleListCollections(config, filter);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].slug).toBe('posts');
	});

	it('should include metadata (slug, label, fieldCount)', () => {
		const config = makeConfig([
			makeCollection('posts', {
				fields: [
					{ name: 'title', type: 'text' },
					{ name: 'body', type: 'richText' },
				],
			} as Partial<CollectionConfig>),
		]);
		const result = handleListCollections(config, allowAll);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed[0]).toMatchObject({
			slug: 'posts',
			label: 'Posts',
			fieldCount: 2,
		});
	});

	it('should return empty array when no collections are allowed', () => {
		const config = makeConfig([makeCollection('posts')]);
		const result = handleListCollections(config, allowNone);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed).toEqual([]);
	});
});

describe('handleGetCollectionSchema', () => {
	it('should return serialized schema for an allowed collection', () => {
		const config = makeConfig([
			makeCollection('posts', {
				fields: [
					{ name: 'title', type: 'text', required: true },
					{ name: 'body', type: 'richText' },
				],
			} as Partial<CollectionConfig>),
		]);
		const result = handleGetCollectionSchema('posts', config, allowAll);
		expect(result.isError).toBeUndefined();
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.slug).toBe('posts');
		expect(parsed.fields).toHaveLength(2);
	});

	it('should return error for unknown collection', () => {
		const config = makeConfig([]);
		const result = handleGetCollectionSchema('unknown', config, allowAll);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('unknown');
	});

	it('should return error for denied collection', () => {
		const config = makeConfig([makeCollection('secrets')]);
		const result = handleGetCollectionSchema('secrets', config, allowNone);
		expect(result.isError).toBe(true);
	});
});
