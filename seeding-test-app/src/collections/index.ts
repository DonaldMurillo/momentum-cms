import { Categories } from './categories.collection';
import { Articles } from './articles.collection';
import type { CollectionConfig } from '@momentum-cms/core';

export const collections: CollectionConfig[] = [Categories, Articles];

export { Categories, Articles };
