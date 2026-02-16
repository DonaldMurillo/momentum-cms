# Versions & Drafts

Enable document versioning to track changes, support drafts, and schedule publishing.

## Enable Versions

```typescript
export const Posts = defineCollection({
	slug: 'posts',
	versions: true, // Basic versioning
	fields: [],
});
```

### With Drafts and Autosave

```typescript
versions: {
  drafts: {
    autosave: {
      interval: 5000,  // Auto-save every 5 seconds
    },
  },
  maxPerDoc: 50,  // Keep at most 50 versions per document
}
```

## Document Status

Versioned documents have a `_status` field:

- `'draft'` — Not publicly visible
- `'published'` — Publicly visible

## Version Snapshots

Each version stores a full JSON snapshot of the document at that point in time:

```typescript
interface DocumentVersion {
	id: string;
	parent: string; // Parent document ID
	version: string; // Full document snapshot (JSON)
	_status: 'draft' | 'published';
	autosave: boolean;
	publishedAt?: string;
	createdAt: string;
	updatedAt: string;
}
```

## API Endpoints

| Method | Path                                               | Description                 |
| ------ | -------------------------------------------------- | --------------------------- |
| GET    | `/api/:collection/:id/versions`                    | List versions               |
| GET    | `/api/:collection/:id/versions/:versionId`         | Get specific version        |
| POST   | `/api/:collection/:id/versions/:versionId/restore` | Restore version             |
| POST   | `/api/:collection/:id/publish`                     | Publish document            |
| POST   | `/api/:collection/:id/unpublish`                   | Unpublish (revert to draft) |
| POST   | `/api/:collection/:id/schedule-publish`            | Schedule future publish     |

### Query Parameters for Version Listing

```
?limit=10&page=1&sort=desc&includeAutosave=false&status=published
```

## Scheduled Publishing

Schedule a document to be published at a future date:

```bash
POST /api/posts/:id/schedule-publish
Content-Type: application/json

{ "publishAt": "2025-12-01T00:00:00Z" }
```

## Access Control

```typescript
access: {
  readVersions: ({ req }) => !!req.user,
  publishVersions: ({ req }) => req.user?.role === 'admin',
  restoreVersions: ({ req }) => req.user?.role === 'admin',
}
```

## Related

- [REST API](../server/rest-api.md) — Full endpoint reference
- [Access Control](access-control.md) — Version-related access functions
