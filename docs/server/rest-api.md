# REST API

All auto-generated REST endpoints for collections.

## Collection CRUD

| Method | Path                     | Description        |
| ------ | ------------------------ | ------------------ |
| GET    | `/api/:collection`       | List documents     |
| GET    | `/api/:collection/:id`   | Get document by ID |
| POST   | `/api/:collection`       | Create document    |
| PATCH  | `/api/:collection/:id`   | Update document    |
| DELETE | `/api/:collection/:id`   | Delete document    |
| GET    | `/api/:collection/count` | Count documents    |

### Query Parameters (GET list)

| Parameter | Type   | Description                      |
| --------- | ------ | -------------------------------- |
| `limit`   | number | Max results (default: 10)        |
| `page`    | number | Page number (default: 1)         |
| `sort`    | string | Sort field (prefix `-` for desc) |
| `where`   | JSON   | Filter conditions                |

### Response Format (List)

```json
{
  "docs": [...],
  "totalDocs": 42,
  "totalPages": 5,
  "page": 1,
  "limit": 10,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

## Soft Delete Endpoints

| Method | Path                           | Description            |
| ------ | ------------------------------ | ---------------------- |
| GET    | `/api/:collection/trash`       | List trashed documents |
| POST   | `/api/:collection/:id/restore` | Restore from trash     |
| DELETE | `/api/:collection/:id/force`   | Permanently delete     |

## Version Endpoints

| Method | Path                                               | Description      |
| ------ | -------------------------------------------------- | ---------------- |
| GET    | `/api/:collection/:id/versions`                    | List versions    |
| GET    | `/api/:collection/:id/versions/:versionId`         | Get version      |
| POST   | `/api/:collection/:id/versions/:versionId/restore` | Restore version  |
| POST   | `/api/:collection/:id/publish`                     | Publish          |
| POST   | `/api/:collection/:id/unpublish`                   | Unpublish        |
| POST   | `/api/:collection/:id/schedule-publish`            | Schedule publish |

## Global Endpoints

| Method | Path                 | Description            |
| ------ | -------------------- | ---------------------- |
| GET    | `/api/globals/:slug` | Get global document    |
| PATCH  | `/api/globals/:slug` | Update global document |

## Media Endpoints

| Method | Path                | Description |
| ------ | ------------------- | ----------- |
| POST   | `/api/media/upload` | Upload file |
| DELETE | `/api/media/:id`    | Delete file |

## Auth Endpoints

| Method | Path                      | Description     |
| ------ | ------------------------- | --------------- |
| POST   | `/api/auth/sign-up/email` | Register        |
| POST   | `/api/auth/sign-in/email` | Login           |
| POST   | `/api/auth/sign-out`      | Logout          |
| GET    | `/api/auth/session`       | Current session |

## Batch Operations

| Method | Path                     | Description                |
| ------ | ------------------------ | -------------------------- |
| POST   | `/api/:collection/batch` | Batch create/update/delete |

## Error Responses

```json
{
	"error": "ValidationError",
	"message": "Validation failed",
	"errors": [{ "field": "title", "message": "Title is required" }]
}
```

| Status | Error                            |
| ------ | -------------------------------- |
| 400    | Validation error                 |
| 401    | Not authenticated                |
| 403    | Access denied                    |
| 404    | Document not found               |
| 409    | Conflict (referential integrity) |
| 500    | Internal server error            |

## Related

- [Custom Endpoints](../collections/custom-endpoints.md) — Add your own routes
- [Access Control](../collections/access-control.md) — Control endpoint access
