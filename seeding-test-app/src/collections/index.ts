import { Categories } from './categories.collection';
import { Articles } from './articles.collection';
import { MediaCollection } from '@momentum-cms/core';
import { Users } from './users.collection';
import type { CollectionConfig } from '@momentum-cms/core';

export const collections: CollectionConfig[] = [Categories, Articles, MediaCollection, Users];

export { Categories, Articles, MediaCollection, Users };
