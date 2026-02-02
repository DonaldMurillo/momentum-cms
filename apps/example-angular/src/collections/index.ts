import { Posts } from './posts.collection';
import { Users } from './users.collection';
import type { CollectionConfig } from '@momentum-cms/core';

export const collections: CollectionConfig[] = [Posts, Users];

export { Posts, Users };
