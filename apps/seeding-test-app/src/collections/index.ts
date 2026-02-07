import { Categories } from './categories.collection';
import { Articles } from './articles.collection';
import { Products } from './products.collection';
import { Pages } from './pages.collection';
import { Settings } from './settings.collection';
import { Events } from './events.collection';
import { MediaCollection } from '@momentum-cms/core';
import { Users } from './users.collection';
import { HookTestItems } from './hook-test-items.collection';
import { FieldTestItems } from './field-test-items.collection';
import { Tags } from './tags.collection';
import type { CollectionConfig } from '@momentum-cms/core';

export const collections: CollectionConfig[] = [
	Categories,
	Articles,
	Products,
	Pages,
	Settings,
	Events,
	MediaCollection,
	Users,
	HookTestItems,
	FieldTestItems,
	Tags,
];

export {
	Categories,
	Articles,
	Products,
	Pages,
	Settings,
	Events,
	MediaCollection,
	Users,
	HookTestItems,
	FieldTestItems,
	Tags,
};
