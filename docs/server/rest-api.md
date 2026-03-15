# REST API

All auto-generated REST endpoints for collections. See also the [interactive OpenAPI docs](openapi.md) at `/api/docs`.

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
| `where`   | JSON   | Filter conditions (see below)    |

### Where Clause Operators

The `where` parameter accepts a JSON object mapping field names to operator objects.
Two URL formats are supported:

- **JSON**: `?where={"title":{"contains":"hello"}}`
- **Nested query string**: `?where[title][contains]=hello`

#### Available Operators

| Operator      | Description                        | Example                                   |
| ------------- | ---------------------------------- | ----------------------------------------- |
| `equals`      | Exact match                        | `{"status":{"equals":"published"}}`       |
| _(shorthand)_ | Direct value = equals              | `{"status":"published"}`                  |
| `not_equals`  | Not equal                          | `{"status":{"not_equals":"archived"}}`    |
| `gt`          | Greater than                       | `{"price":{"gt":50}}`                     |
| `gte`         | Greater than or equal              | `{"price":{"gte":50}}`                    |
| `lt`          | Less than                          | `{"price":{"lt":100}}`                    |
| `lte`         | Less than or equal                 | `{"price":{"lte":100}}`                   |
| `like`        | SQL LIKE pattern (case-sensitive)  | `{"title":{"like":"%hello%"}}`            |
| `contains`    | Substring match (case-insensitive) | `{"title":{"contains":"hello"}}`          |
| `in`          | Match any value in array           | `{"status":{"in":["draft","published"]}}` |
| `not_in`      | Exclude values in array            | `{"status":{"not_in":["archived"]}}`      |
| `exists`      | Null check (true=IS NOT NULL)      | `{"category":{"exists":true}}`            |

#### Combining Operators

Multiple operators on the same field are ANDed together (range queries):

```
?where={"price":{"gte":10,"lte":100}}
```

Multiple fields are also ANDed:

```
?where={"price":{"gte":10},"name":{"contains":"widget"}}
```

#### OR / AND Logical Operators

Use `or` and `and` arrays for complex boolean queries:

```
?where={"or":[{"name":{"equals":"A"}},{"name":{"equals":"B"}}]}
```

Nesting is supported up to 5 levels deep:

```
?where={"or":[{"and":[{"price":{"gt":10}},{"name":{"contains":"x"}}]},{"status":"published"}]}
```

#### Relationship Sub-Field Queries

Filter by fields on related documents (generates EXISTS subquery):

```
?where={"category":{"name":{"contains":"Tech"}}}
```

Direct relationship ID filtering still works:

```
?where={"category":"some-id"}
?where={"category":{"in":["id1","id2"]}}
```

#### Security Limits

| Limit                                | Value | Description                    |
| ------------------------------------ | ----- | ------------------------------ |
| Max conditions per where clause      | 20    | Prevents expensive queries     |
| Max `in`/`not_in` array size         | 500   | Prevents oversized IN clauses  |
| Max `contains`/`like` pattern length | 1000  | Prevents regex/pattern abuse   |
| Max nesting depth (or/and)           | 5     | Prevents deeply nested queries |

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
