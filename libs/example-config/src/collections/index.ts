import { Categories } from './categories.collection';
import { Articles } from './articles.collection';
import { Products } from './products.collection';
import { Pages } from './pages.collection';
import { Settings } from './settings.collection';
import { Events } from './events.collection';
import { MediaCollection } from '@momentumcms/core';
import { HookTestItems } from './hook-test-items.collection';
import { FieldTestItems } from './field-test-items.collection';
import { Tags } from './tags.collection';
import { UserNotes } from './user-notes.collection';
import type { CollectionConfig } from '@momentumcms/core';

export const collections: CollectionConfig[] = [
	Categories,
	Articles,
	Products,
	Pages,
	Settings,
	Events,
	MediaCollection,
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
	MediaCollection,
	HookTestItems,
	FieldTestItems,
	Tags,
	UserNotes,
};
