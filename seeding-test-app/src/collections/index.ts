import { Categories } from './categories.collection';
import { Articles } from './articles.collection';
import { Users } from './users.collection';
import type { CollectionConfig } from '@momentum-cms/core';

export const collections: CollectionConfig[] = [Categories, Articles, Users];

export { Categories, Articles, Users };
