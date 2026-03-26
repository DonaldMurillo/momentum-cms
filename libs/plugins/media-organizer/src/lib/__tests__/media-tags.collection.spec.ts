import { describe, it, expect, vi, afterEach } from 'vitest';
import { MediaTagsCollection, registerUploadCollectionSlugs } from '../media-tags.collection';

describe('MediaTagsCollection', () => {
	afterEach(() => {
		// Reset to default after tests that register custom slugs
		registerUploadCollectionSlugs(['media']);
	});

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

	it('should remove deleted tag ids from media docs', async () => {
		const afterDelete = MediaTagsCollection.hooks?.afterDelete?.[0];
		expect(afterDelete).toBeDefined();

		const find = vi
			.fn()
			.mockResolvedValueOnce({
				docs: [
					{ id: 'media-1', tags: ['tag-1', 'tag-2'] },
					{ id: 'media-2', tags: [{ id: 'tag-1' }] },
				],
			})
			.mockResolvedValueOnce({ docs: [] });
		const update = vi.fn().mockResolvedValue({});
		const collection = vi.fn().mockReturnValue({ find, update });

		await afterDelete?.({
			doc: { id: 'tag-1' },
			req: { api: { collection } },
		} as never);

		expect(update).toHaveBeenNthCalledWith(1, 'media-1', { tags: ['tag-2'] });
		expect(update).toHaveBeenNthCalledWith(2, 'media-2', { tags: [] });
	});

	it('should clean up tags from all registered upload collections, not just media', async () => {
		const afterDelete = MediaTagsCollection.hooks?.afterDelete?.[0];
		expect(afterDelete).toBeDefined();

		// Register multiple upload collections
		registerUploadCollectionSlugs(['media', 'avatars', 'documents']);

		const findMedia = vi
			.fn()
			.mockResolvedValueOnce({ docs: [{ id: 'm1', tags: ['tag-1'] }] })
			.mockResolvedValueOnce({ docs: [] });
		const updateMedia = vi.fn().mockResolvedValue({});

		const findAvatars = vi
			.fn()
			.mockResolvedValueOnce({ docs: [{ id: 'a1', tags: ['tag-1', 'tag-2'] }] })
			.mockResolvedValueOnce({ docs: [] });
		const updateAvatars = vi.fn().mockResolvedValue({});

		const findDocuments = vi.fn().mockResolvedValueOnce({ docs: [] });

		const collection = vi.fn().mockImplementation((slug: string) => {
			if (slug === 'media') return { find: findMedia, update: updateMedia };
			if (slug === 'avatars') return { find: findAvatars, update: updateAvatars };
			if (slug === 'documents') return { find: findDocuments, update: vi.fn() };
			throw new Error(`Unexpected collection: ${slug}`);
		});

		await afterDelete?.({
			doc: { id: 'tag-1' },
			req: { api: { collection } },
		} as never);

		// Should have cleaned up from both media and avatars
		expect(collection).toHaveBeenCalledWith('media');
		expect(collection).toHaveBeenCalledWith('avatars');
		expect(collection).toHaveBeenCalledWith('documents');
		expect(updateMedia).toHaveBeenCalledWith('m1', { tags: [] });
		expect(updateAvatars).toHaveBeenCalledWith('a1', { tags: ['tag-2'] });
	});

	it('should filter media by tag ID instead of scanning all documents', async () => {
		const afterDelete = MediaTagsCollection.hooks?.afterDelete?.[0];
		expect(afterDelete).toBeDefined();

		const find = vi.fn().mockResolvedValueOnce({ docs: [] });
		const update = vi.fn().mockResolvedValue({});
		const collection = vi.fn().mockReturnValue({ find, update });

		await afterDelete?.({
			doc: { id: 'tag-42' },
			req: { api: { collection } },
		} as never);

		// The find call should include a where clause filtering by the tag ID
		expect(find).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tags: expect.objectContaining({ in: ['tag-42'] }),
				}),
			}),
		);
	});

	it('should always query page 1 to avoid skipping documents after updates', async () => {
		const afterDelete = MediaTagsCollection.hooks?.afterDelete?.[0];
		expect(afterDelete).toBeDefined();

		// Simulate 2 pages: first call returns docs, second returns empty
		const find = vi
			.fn()
			.mockResolvedValueOnce({
				docs: [{ id: 'media-1', tags: ['tag-1', 'tag-2'] }],
			})
			.mockResolvedValueOnce({ docs: [] });
		const update = vi.fn().mockResolvedValue({});
		const collection = vi.fn().mockReturnValue({ find, update });

		await afterDelete?.({
			doc: { id: 'tag-1' },
			req: { api: { collection } },
		} as never);

		// Both calls should use page: 1 — after updating docs on page 1,
		// they drop out of the filter, so the next batch naturally appears on page 1
		expect(find).toHaveBeenCalledTimes(2);
		for (const call of find.mock.calls) {
			expect(call[0]).toMatchObject({ page: 1 });
		}
	});

	it('should enforce a maximum page safety cap', async () => {
		const afterDelete = MediaTagsCollection.hooks?.afterDelete?.[0];
		expect(afterDelete).toBeDefined();

		// Return non-empty results forever to simulate a pathological case
		const find = vi.fn().mockResolvedValue({
			docs: [{ id: 'media-x', tags: ['tag-1'] }],
		});
		const update = vi.fn().mockResolvedValue({});
		const collection = vi.fn().mockReturnValue({ find, update });

		await afterDelete?.({
			doc: { id: 'tag-1' },
			req: { api: { collection } },
		} as never);

		// Should terminate and not run forever
		expect(find.mock.calls.length).toBeLessThanOrEqual(100);
	});
});
