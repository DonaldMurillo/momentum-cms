import type { MomentumPlugin, PluginContext, PluginReadyContext } from '@momentumcms/plugins/core';
import { MediaFoldersCollection } from './media-folders.collection';
import { MediaTagsCollection, registerUploadCollectionSlugs } from './media-tags.collection';
import { mediaOrganizerModifyCollections } from './modify-collections';

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

		// Browser-safe import paths for the admin config generator
		browserImports: {
			modifyCollections: {
				path: '@momentumcms/plugins-media-organizer/modify-collections',
				exportName: 'mediaOrganizerModifyCollections',
			},
		},

		modifyCollections(collections) {
			if (!enabled) return;
			mediaOrganizerModifyCollections(collections);
			const uploadSlugs: string[] = [];
			for (const col of collections) {
				if (!col.upload) continue;
				uploadSlugs.push(col.slug);
			}
			registerUploadCollectionSlugs(uploadSlugs);
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
