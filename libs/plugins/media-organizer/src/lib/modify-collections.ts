/**
 * Browser-safe modifyCollections for the media-organizer plugin.
 * Injects `folder` and `tags` relationship fields into all upload collections.
 *
 * This module is safe to import in browser bundles — it only depends on
 * `@momentumcms/core` (universal) and the collection definitions.
 */
import { relationship } from '@momentumcms/core';
import type { CollectionConfig } from '@momentumcms/core';
import { MediaFoldersCollection } from './media-folders.collection';
import { MediaTagsCollection } from './media-tags.collection';

export function mediaOrganizerModifyCollections(collections: CollectionConfig[]): void {
	for (const col of collections) {
		if (!col.upload) continue;
		// Skip if folder/tags already injected (idempotent)
		if (col.fields.some((f) => f.name === 'folder')) continue;
		col.fields.push(
			relationship('folder', {
				collection: () => MediaFoldersCollection,
				onDelete: 'set-null',
				label: 'Folder',
			}),
			relationship('tags', {
				collection: () => MediaTagsCollection,
				hasMany: true,
				label: 'Tags',
			}),
		);
	}
}
