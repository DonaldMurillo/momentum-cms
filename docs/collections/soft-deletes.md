# Soft Deletes

Soft deletes move documents to trash instead of permanently removing them.

## Enable Soft Deletes

```typescript
export const Posts = defineCollection({
	slug: 'posts',
	softDelete: true, // Uses defaults
	fields: [],
});
```

### With Options

```typescript
softDelete: {
  field: 'deletedAt',    // Column name (default: 'deletedAt')
  retentionDays: 30,     // Auto-purge after 30 days (undefined = never)
}
```

## How It Works

- **DELETE** requests set `deletedAt` to the current timestamp instead of removing the row
- Soft-deleted documents are excluded from normal queries
- Documents can be restored or permanently deleted

## Access Control

Two additional access functions control soft delete operations:

```typescript
access: {
  restore: ({ req }) => req.user?.role === 'admin',       // Falls back to update access
  forceDelete: ({ req }) => req.user?.role === 'admin',   // Falls back to delete access
}
```

## API Endpoints

| Method | Path                           | Description                     |
| ------ | ------------------------------ | ------------------------------- |
| GET    | `/api/:collection/trash`       | List soft-deleted documents     |
| POST   | `/api/:collection/:id/restore` | Restore a soft-deleted document |
| DELETE | `/api/:collection/:id/force`   | Permanently delete              |

## Hooks

Soft delete triggers `beforeDelete`/`afterDelete` hooks with `operation: 'softDelete'`.

Restore triggers `beforeRestore`/`afterRestore` hooks.

## Related

- [Access Control](access-control.md) — `restore` and `forceDelete` access
- [REST API](../server/rest-api.md) — Full endpoint reference
