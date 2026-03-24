import type { MomentumPlugin, PluginContext, PluginReadyContext } from '@momentumcms/plugins/core';
import { relationship } from '@momentumcms/core';
import { MediaFoldersCollection } from './media-folders.collection';
import { MediaTagsCollection } from './media-tags.collection';

export interface MediaOrganizerPluginConfig {
	/** Disable the plugin without removing it from config. @default true */
	enabled?: boolean;
}

/**
 * Creates a media organizer plugin that adds folder/tag organization
 * to all upload collections.
 */
export function mediaOrganizerPlugin(config: MediaOrganizerPluginConfig = {}): MomentumPlugin {
	const { enabled = true } = config;

	return {
		name: 'media-organizer',
		collections: [MediaFoldersCollection, MediaTagsCollection],

		modifyCollections(collections) {
			if (!enabled) return;
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
		},

		async onInit({ collections, logger }: PluginContext) {
			if (!enabled) {
				logger.info('Media Organizer plugin disabled');
				return;
			}

			// Add collections (guard prevents duplicate on re-init)
			if (!collections.some((c) => c.slug === 'media-folders')) {
				collections.push(MediaFoldersCollection);
			}
			if (!collections.some((c) => c.slug === 'media-tags')) {
				collections.push(MediaTagsCollection);
			}

			logger.info('Media Organizer plugin initialized');
		},

		async onReady({ logger }: PluginReadyContext) {
			if (!enabled) return;
			logger.info('Media Organizer plugin ready');
		},

		async onShutdown({ logger }) {
			logger.info('Media Organizer plugin shut down');
		},
	};
}
