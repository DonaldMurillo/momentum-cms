import { describe, it, expect } from 'vitest';
import {
	serializeFields,
	serializeCollection,
	getCollectionPluralLabel,
} from '../schema-serializer';
import type { Field, CollectionConfig } from '@momentumcms/core';

describe('getCollectionPluralLabel', () => {
	it('should return labels.plural when present and a string', () => {
		expect(getCollectionPluralLabel({ slug: 'posts', labels: { plural: 'Posts' } })).toBe('Posts');
	});

	it('should fall back to slug when labels is missing', () => {
		expect(getCollectionPluralLabel({ slug: 'posts' })).toBe('posts');
	});

	it('should fall back to slug when labels has no plural key', () => {
		expect(getCollectionPluralLabel({ slug: 'posts', labels: { singular: 'Post' } })).toBe('posts');
	});

	it('should fall back to slug when labels.plural is not a string', () => {
		expect(getCollectionPluralLabel({ slug: 'posts', labels: { plural: 123 } })).toBe('posts');
		expect(getCollectionPluralLabel({ slug: 'posts', labels: { plural: null } })).toBe('posts');
	});

	it('should fall back to slug when labels is not an object', () => {
		expect(getCollectionPluralLabel({ slug: 'posts', labels: 'Posts' })).toBe('posts');
	});
});

describe('serializeFields', () => {
	it('should serialize a text field', () => {
		const fields: Field[] = [
			{ name: 'title', type: 'text', required: true, label: 'Title', description: 'The title' },
		];
		const result = serializeFields(fields);
		expect(result).toEqual([
			{
				name: 'title',
				type: 'text',
				required: true,
				label: 'Title',
				description: 'The title',
			},
		]);
	});

	it('should serialize a select field with options', () => {
		const fields: Field[] = [
			{
				name: 'status',
				type: 'select',
				options: [
					{ label: 'Draft', value: 'draft' },
					{ label: 'Published', value: 'published' },
				],
			},
		];
		const result = serializeFields(fields);
		expect(result).toEqual([
			{
				name: 'status',
				type: 'select',
				options: [
					{ label: 'Draft', value: 'draft' },
					{ label: 'Published', value: 'published' },
				],
			},
		]);
	});

	it('should serialize a relationship field with relationTo', () => {
		const fields: Field[] = [
			{
				name: 'author',
				type: 'relationship',
				collection: () => ({ slug: 'users' }),
				hasMany: false,
			},
		];
		const result = serializeFields(fields);
		expect(result).toEqual([
			{
				name: 'author',
				type: 'relationship',
				relationTo: 'users',
				hasMany: false,
			},
		]);
	});

	it('should serialize nested group fields', () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [
					{ name: 'description', type: 'textarea' },
					{ name: 'keywords', type: 'text' },
				],
			},
		];
		const result = serializeFields(fields);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('meta');
		expect(result[0].fields).toHaveLength(2);
		expect(result[0].fields?.[0].name).toBe('description');
	});

	it('should serialize array fields with sub-fields', () => {
		const fields: Field[] = [
			{
				name: 'items',
				type: 'array',
				fields: [{ name: 'label', type: 'text', required: true }],
				minRows: 1,
				maxRows: 10,
			},
		];
		const result = serializeFields(fields);
		expect(result[0]).toMatchObject({
			name: 'items',
			type: 'array',
			minRows: 1,
			maxRows: 10,
		});
		expect(result[0].fields).toHaveLength(1);
	});

	it('should exclude password fields', () => {
		const fields: Field[] = [
			{ name: 'email', type: 'email' },
			{ name: 'password', type: 'password' },
		];
		const result = serializeFields(fields);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('email');
	});

	it('should flatten layout fields (tabs)', () => {
		const fields: Field[] = [
			{
				name: 'content-tabs',
				type: 'tabs',
				tabs: [
					{
						label: 'Content',
						fields: [
							{ name: 'title', type: 'text' },
							{ name: 'body', type: 'richText' },
						],
					},
					{
						label: 'Meta',
						fields: [{ name: 'slug', type: 'slug' }],
					},
				],
			} as unknown as Field,
		];
		const result = serializeFields(fields);
		expect(result).toHaveLength(3);
		expect(result.map((f) => f.name)).toEqual(['title', 'body', 'slug']);
	});

	it('should flatten layout fields (collapsible)', () => {
		const fields: Field[] = [
			{
				name: 'advanced',
				type: 'collapsible',
				fields: [
					{ name: 'cssClass', type: 'text' },
					{ name: 'hidden', type: 'checkbox' },
				],
			} as unknown as Field,
		];
		const result = serializeFields(fields);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('cssClass');
	});

	it('should flatten layout fields (row)', () => {
		const fields: Field[] = [
			{
				name: 'row1',
				type: 'row',
				fields: [
					{ name: 'firstName', type: 'text' },
					{ name: 'lastName', type: 'text' },
				],
			} as unknown as Field,
		];
		const result = serializeFields(fields);
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('firstName');
	});

	it('should strip admin-only config (hooks, access, conditions)', () => {
		const fields: Field[] = [
			{
				name: 'title',
				type: 'text',
				hooks: { beforeChange: [() => 'x'] },
				access: { read: () => true },
				admin: { condition: () => true },
				validate: () => true,
			} as unknown as Field,
		];
		const result = serializeFields(fields);
		expect(result[0]).toEqual({ name: 'title', type: 'text' });
		expect(result[0]).not.toHaveProperty('hooks');
		expect(result[0]).not.toHaveProperty('access');
		expect(result[0]).not.toHaveProperty('admin');
		expect(result[0]).not.toHaveProperty('validate');
	});

	it('should exclude top-level fields marked admin.hidden: true', () => {
		const fields: Field[] = [
			{ name: 'visible', type: 'text' },
			{ name: 'internalNotes', type: 'textarea', admin: { hidden: true } } as unknown as Field,
			{
				name: 'paymentToken',
				type: 'text',
				admin: { hidden: true, readOnly: true },
			} as unknown as Field,
		];
		const result = serializeFields(fields);
		expect(result.map((f) => f.name)).toEqual(['visible']);
	});

	it('should exclude nested hidden fields inside group/array', () => {
		const fields: Field[] = [
			{
				name: 'meta',
				type: 'group',
				fields: [
					{ name: 'description', type: 'textarea' },
					{ name: 'secret', type: 'text', admin: { hidden: true } } as unknown as Field,
				],
			},
		];
		const result = serializeFields(fields);
		expect(result[0].fields?.map((f) => f.name)).toEqual(['description']);
	});

	it('should exclude hidden fields nested inside layout (tabs) wrappers', () => {
		const fields: Field[] = [
			{
				name: 'tabs',
				type: 'tabs',
				tabs: [
					{
						label: 'Main',
						fields: [
							{ name: 'title', type: 'text' },
							{ name: 'apiKey', type: 'text', admin: { hidden: true } },
						],
					},
				],
			} as unknown as Field,
		];
		const result = serializeFields(fields);
		expect(result.map((f) => f.name)).toEqual(['title']);
	});

	it('should keep fields when admin.hidden is false or not set', () => {
		const fields: Field[] = [
			{ name: 'a', type: 'text', admin: { hidden: false } } as unknown as Field,
			{ name: 'b', type: 'text', admin: { readOnly: true } } as unknown as Field,
			{ name: 'c', type: 'text' },
		];
		const result = serializeFields(fields);
		expect(result.map((f) => f.name)).toEqual(['a', 'b', 'c']);
	});

	it('should handle upload fields', () => {
		const fields: Field[] = [
			{
				name: 'image',
				type: 'upload',
				relationTo: 'media',
				mimeTypes: ['image/*'],
			},
		];
		const result = serializeFields(fields);
		expect(result[0]).toMatchObject({
			name: 'image',
			type: 'upload',
			relationTo: 'media',
		});
	});

	it('should handle empty fields array', () => {
		expect(serializeFields([])).toEqual([]);
	});
});

describe('serializeCollection', () => {
	it('should serialize a collection with metadata', () => {
		const config = {
			slug: 'posts',
			labels: { singular: 'Post', plural: 'Posts' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{ name: 'body', type: 'richText' },
			],
			timestamps: true,
			versions: { drafts: true },
			softDelete: { enabled: true },
		} as unknown as CollectionConfig;

		const result = serializeCollection(config);
		expect(result.slug).toBe('posts');
		expect(result.label).toBe('Posts');
		expect(result.fields).toHaveLength(2);
		expect(result.timestamps).toBe(true);
		expect(result.versioning).toBe(true);
		expect(result.softDelete).toBe(true);
	});

	it('should default label to slug when labels not provided', () => {
		const config = {
			slug: 'items',
			fields: [],
		} as unknown as CollectionConfig;

		const result = serializeCollection(config);
		expect(result.label).toBe('items');
	});
});
