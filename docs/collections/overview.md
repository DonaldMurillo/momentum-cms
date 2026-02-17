# Collections Overview

Collections are the core data model in Momentum CMS. Each collection defines a database table, REST API endpoints, and an admin UI.

## defineCollection

```typescript
import { defineCollection, text, richText } from '@momentumcms/core';

export const Posts = defineCollection({
	slug: 'posts',
	fields: [text('title', { required: true }), richText('content')],
});
```

## Full Configuration

```typescript
export const Posts = defineCollection({
  // Required
  slug: 'posts',                    // URL and database identifier
  fields: [...],                     // Field definitions

  // Optional
  labels: {                          // Custom display names
    singular: 'Post',
    plural: 'Posts',
  },
  dbName: 'blog_posts',             // Custom database table name
  defaultSort: '-createdAt',        // Default sort field (prefix - for desc)
  managed: false,                   // If true, schema only (no CRUD routes)
  timestamps: true,                 // Adds createdAt/updatedAt (default: true)

  admin: { ... },                   // Admin UI configuration
  access: { ... },                  // Access control
  hooks: { ... },                   // Lifecycle hooks
  auth: false,                      // Enable auth (makes it a user collection)
  versions: false,                  // Enable versioning/drafts
  softDelete: false,                // Enable soft deletes
  indexes: [],                      // Custom database indexes
  endpoints: [],                    // Custom API endpoints
  webhooks: [],                     // Webhook subscriptions

  graphQL: {                        // GraphQL configuration
    singularName: 'post',
    pluralName: 'posts',
    disableQueries: false,
    disableMutations: false,
  },

  defaultWhere: (req) => undefined, // Default query constraints
});
```

## Admin Configuration

```typescript
admin: {
  useAsTitle: 'title',              // Field to display as document title
  defaultColumns: ['title', 'status', 'createdAt'],
  group: 'Content',                 // Dashboard and sidebar group
  listSearchableFields: ['title', 'content'],
  description: 'Blog posts',
  hidden: false,                    // Hide from navigation
  preview: (doc) => `/posts/${doc.slug}`,
  pagination: {
    defaultLimit: 10,
    limits: [10, 25, 50, 100],
  },
  headerActions: [{                 // Custom action buttons
    id: 'export',
    label: 'Export',
    endpoint: '/api/posts/export',
  }],
}
```

## Indexes

```typescript
indexes: [
	{ columns: ['slug'], unique: true },
	{ columns: ['status', 'createdAt'] },
	{ columns: ['authorId'], name: 'idx_posts_author' },
];
```

## Related

- [Fields](fields.md) — All field types
- [Access Control](access-control.md) — Restrict operations
- [Hooks](hooks.md) — Lifecycle hooks
- [Soft Deletes](soft-deletes.md) — Trash and restore
- [Versions & Drafts](versions-and-drafts.md) — Document versioning
- [Globals](globals.md) — Singleton collections
- [Webhooks](webhooks.md) — Event subscriptions
- [Custom Endpoints](custom-endpoints.md) — Add your own routes
