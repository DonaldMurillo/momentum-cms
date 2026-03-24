import { describe, it, expect } from 'vitest';
import { MediaFoldersCollection } from '../media-folders.collection';

describe('MediaFoldersCollection', () => {
	it('should have slug "media-folders"', () => {
		expect(MediaFoldersCollection.slug).toBe('media-folders');
	});

	it('should have correct labels', () => {
		expect(MediaFoldersCollection.labels).toEqual({
			singular: 'Media Folder',
			plural: 'Media Folders',
		});
	});

	it('should have name field that is required', () => {
		const nameField = MediaFoldersCollection.fields.find((f) => f.name === 'name');
		expect(nameField).toBeDefined();
		expect(nameField?.type).toBe('text');
		expect(nameField?.required).toBe(true);
	});

	it('should have self-referencing parent relationship', () => {
		const parentField = MediaFoldersCollection.fields.find((f) => f.name === 'parent');
		expect(parentField).toBeDefined();
		expect(parentField?.type).toBe('relationship');
		if (parentField?.type === 'relationship') {
			const target = parentField.collection();
			expect(target).toBe(MediaFoldersCollection);
			expect(parentField.onDelete).toBe('set-null');
		}
	});

	it('should NOT have a stored path field (computed client-side)', () => {
		const pathField = MediaFoldersCollection.fields.find((f) => f.name === 'path');
		expect(pathField).toBeUndefined();
	});

	it('should have unique index on [name, parent]', () => {
		expect(MediaFoldersCollection.indexes).toBeDefined();
		const idx = MediaFoldersCollection.indexes?.find(
			(i) => i.columns.includes('name') && i.columns.includes('parent'),
		);
		expect(idx).toBeDefined();
		expect(idx?.unique).toBe(true);
	});

	it('should have a beforeChange hook for cycle prevention', () => {
		expect(MediaFoldersCollection.hooks?.beforeChange).toBeDefined();
		expect(MediaFoldersCollection.hooks?.beforeChange?.length).toBeGreaterThan(0);
	});

	it('should be hidden in admin and grouped under Media', () => {
		expect(MediaFoldersCollection.admin?.hidden).toBe(true);
		expect(MediaFoldersCollection.admin?.group).toBe('Media');
	});

	it('should use name as title', () => {
		expect(MediaFoldersCollection.admin?.useAsTitle).toBe('name');
	});

	it('should allow public read access', () => {
		const result = MediaFoldersCollection.access?.read?.({} as never);
		expect(result).toBe(true);
	});

	it('should require authentication for create/update/delete', () => {
		const noUser = { req: {} } as never;
		const withUser = { req: { user: { id: '1' } } } as never;

		expect(MediaFoldersCollection.access?.create?.(noUser)).toBe(false);
		expect(MediaFoldersCollection.access?.create?.(withUser)).toBe(true);
		expect(MediaFoldersCollection.access?.update?.(noUser)).toBe(false);
		expect(MediaFoldersCollection.access?.update?.(withUser)).toBe(true);
		expect(MediaFoldersCollection.access?.delete?.(noUser)).toBe(false);
		expect(MediaFoldersCollection.access?.delete?.(withUser)).toBe(true);
	});
});
