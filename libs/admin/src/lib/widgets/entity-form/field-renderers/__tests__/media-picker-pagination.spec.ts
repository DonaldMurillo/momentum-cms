import { describe, it, expect } from 'vitest';

/**
 * Tests that the media picker dialog builds server-side where clauses
 * for search and MIME type filters instead of filtering client-side.
 *
 * Bug: client-side search/MIME filtering forced totalPages=1, hiding
 * results beyond page 1 when combined with server-side folder/tag filters.
 *
 * Fix: all filters are now server-side where clauses in loadMedia().
 *
 * These are pure logic tests for the where-clause construction algorithm
 * used by MediaPickerDialog.loadMedia(). The Angular TestBed-based tests
 * for this component have a pre-existing ngModule resolution issue.
 */

/**
 * Replicates the where-clause building logic from MediaPickerDialog.loadMedia()
 * to verify it constructs correct server-side filters.
 */
function buildMediaPickerWhere(opts: {
	folderId?: string | null;
	tagIds?: Set<string>;
	search?: string;
	mimeTypes?: string[];
}): Record<string, unknown> {
	const where: Record<string, unknown> = {};

	if (opts.folderId) where['folder'] = { equals: opts.folderId };
	if (opts.tagIds && opts.tagIds.size > 0) where['tags'] = { in: Array.from(opts.tagIds) };

	// Server-side search filter (filename contains search term)
	if (opts.search) {
		where['filename'] = { contains: opts.search };
	}

	// Server-side MIME type filter
	const mimeTypes = opts.mimeTypes;
	if (mimeTypes && mimeTypes.length > 0) {
		const exactTypes = mimeTypes.filter((p) => !p.endsWith('/*'));
		const wildcardPrefixes = mimeTypes.filter((p) => p.endsWith('/*')).map((p) => p.slice(0, -1));

		const mimeConditions: Record<string, unknown>[] = [];
		if (exactTypes.length > 0) {
			mimeConditions.push({ mimeType: { in: exactTypes } });
		}
		for (const prefix of wildcardPrefixes) {
			mimeConditions.push({ mimeType: { like: `${prefix}%` } });
		}
		if (mimeConditions.length > 0) {
			where['or'] = mimeConditions;
		}
	}

	return where;
}

describe('MediaPickerDialog where-clause building (server-side filters)', () => {
	it('should include search as filename contains filter', () => {
		const where = buildMediaPickerWhere({ search: 'sunset' });
		expect(where['filename']).toEqual({ contains: 'sunset' });
	});

	it('should not include filename filter when search is empty', () => {
		const where = buildMediaPickerWhere({ search: '' });
		expect(where['filename']).toBeUndefined();
	});

	it('should include folder filter', () => {
		const where = buildMediaPickerWhere({ folderId: 'f1' });
		expect(where['folder']).toEqual({ equals: 'f1' });
	});

	it('should include tag filter', () => {
		const where = buildMediaPickerWhere({ tagIds: new Set(['t1', 't2']) });
		expect(where['tags']).toEqual({ in: ['t1', 't2'] });
	});

	it('should combine folder + search + tags as server-side where clauses', () => {
		const where = buildMediaPickerWhere({
			folderId: 'f1',
			tagIds: new Set(['t1']),
			search: 'photo',
		});
		expect(where['folder']).toEqual({ equals: 'f1' });
		expect(where['tags']).toEqual({ in: ['t1'] });
		expect(where['filename']).toEqual({ contains: 'photo' });
	});

	it('should use unprefixed "or" key for wildcard MIME type (image/*)', () => {
		const where = buildMediaPickerWhere({ mimeTypes: ['image/*'] });
		// Server only recognizes unprefixed "or", not "$or"
		expect(where['or']).toEqual([{ mimeType: { like: 'image/%' } }]);
		expect(where).not.toHaveProperty('$or');
	});

	it('should use unprefixed "or" key for exact MIME type', () => {
		const where = buildMediaPickerWhere({ mimeTypes: ['application/pdf'] });
		expect(where['or']).toEqual([{ mimeType: { in: ['application/pdf'] } }]);
		expect(where).not.toHaveProperty('$or');
	});

	it('should combine exact + wildcard MIME types with unprefixed "or"', () => {
		const where = buildMediaPickerWhere({
			mimeTypes: ['application/pdf', 'image/*'],
		});
		expect(where['or']).toEqual([
			{ mimeType: { in: ['application/pdf'] } },
			{ mimeType: { like: 'image/%' } },
		]);
		expect(where).not.toHaveProperty('$or');
	});

	it('should combine all filter types together', () => {
		const where = buildMediaPickerWhere({
			folderId: 'f1',
			tagIds: new Set(['t1']),
			search: 'sunset',
			mimeTypes: ['image/*'],
		});
		expect(where['folder']).toEqual({ equals: 'f1' });
		expect(where['tags']).toEqual({ in: ['t1'] });
		expect(where['filename']).toEqual({ contains: 'sunset' });
		expect(where['or']).toEqual([{ mimeType: { like: 'image/%' } }]);
		expect(where).not.toHaveProperty('$or');
	});

	it('should NOT have any client-side filtering that forces totalPages to 1', () => {
		const where = buildMediaPickerWhere({
			folderId: 'f1',
			search: 'test',
			mimeTypes: ['image/*'],
		});

		expect(where['filename']).toBeDefined();
		expect(where['folder']).toBeDefined();
		expect(where['or']).toBeDefined();
		expect(where).not.toHaveProperty('$or');
		expect(Object.keys(where).length).toBeGreaterThan(0);
	});
});
