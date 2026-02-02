/**
 * Momentum CMS Collections
 *
 * Export all collections from this file.
 * The CMS will auto-generate:
 * - REST API endpoints at /api/{slug}
 * - Admin UI forms and lists
 * - Database schema via Drizzle
 */

export { Users } from './users.collection';
export { Posts } from './posts.collection';

// Import all collections for registration
import { Users } from './users.collection';
import { Posts } from './posts.collection';
import type { CollectionConfig } from '@momentum-cms/core';

/**
 * All collections in the CMS
 * Used by the server to generate routes and the admin to render UI
 */
export const collections: CollectionConfig[] = [Users, Posts];
