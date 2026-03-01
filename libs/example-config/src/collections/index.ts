import { Categories } from './categories.collection';
import { Articles } from './articles.collection';
import { Products } from './products.collection';
import { Pages } from './pages.collection';
import { Settings } from './settings.collection';
import { Events } from './events.collection';
import { MediaCollection, defineCollection } from '@momentumcms/core';
import { HookTestItems } from './hook-test-items.collection';
import { FieldTestItems } from './field-test-items.collection';
import { Tags } from './tags.collection';
import { UserNotes } from './user-notes.collection';
import type { CollectionConfig } from '@momentumcms/core';

/**
 * Media collection with image processing sizes configured.
 * Extends the built-in MediaCollection with imageSizes for the image plugin.
 */
const MediaWithImageSizes = defineCollection({
	...MediaCollection,
	upload: {
		...MediaCollection.upload,
		imageSizes: [
			{ name: 'thumbnail', width: 150, height: 150, fit: 'cover' },
			{ name: 'medium', width: 800 },
		],
	},
});

export const collections: CollectionConfig[] = [
	Categories,
	Articles,
	Products,
	Pages,
	Settings,
	Events,
	MediaWithImageSizes,
	HookTestItems,
	FieldTestItems,
	Tags,
	UserNotes,
];

export {
	Categories,
	Articles,
	Products,
	Pages,
	Settings,
	Events,
	MediaWithImageSizes,
	HookTestItems,
	FieldTestItems,
	Tags,
	UserNotes,
};
