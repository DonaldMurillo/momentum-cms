import { describe, it, expect } from 'vitest';
import { MediaTagsCollection } from '../media-tags.collection';

describe('MediaTagsCollection', () => {
	it('should have slug "media-tags"', () => {
		expect(MediaTagsCollection.slug).toBe('media-tags');
	});

	it('should have correct labels', () => {
		expect(MediaTagsCollection.labels).toEqual({
			singular: 'Media Tag',
			plural: 'Media Tags',
		});
	});

	it('should have name field that is required', () => {
		const nameField = MediaTagsCollection.fields.find((f) => f.name === 'name');
		expect(nameField).toBeDefined();
		expect(nameField?.type).toBe('text');
		expect(nameField?.required).toBe(true);
	});

	it('should have color field', () => {
		const colorField = MediaTagsCollection.fields.find((f) => f.name === 'color');
		expect(colorField).toBeDefined();
		expect(colorField?.type).toBe('text');
	});

	it('should have unique index on [name]', () => {
		expect(MediaTagsCollection.indexes).toBeDefined();
		const idx = MediaTagsCollection.indexes?.find((i) => i.columns.includes('name'));
		expect(idx).toBeDefined();
		expect(idx?.unique).toBe(true);
	});

	it('should be hidden in admin and grouped under Media', () => {
		expect(MediaTagsCollection.admin?.hidden).toBe(true);
		expect(MediaTagsCollection.admin?.group).toBe('Media');
	});

	it('should use name as title', () => {
		expect(MediaTagsCollection.admin?.useAsTitle).toBe('name');
	});

	it('should allow public read access', () => {
		const result = MediaTagsCollection.access?.read?.({} as never);
		expect(result).toBe(true);
	});

	it('should require authentication for mutations', () => {
		const noUser = { req: {} } as never;
		const withUser = { req: { user: { id: '1' } } } as never;

		expect(MediaTagsCollection.access?.create?.(noUser)).toBe(false);
		expect(MediaTagsCollection.access?.create?.(withUser)).toBe(true);
	});
});
