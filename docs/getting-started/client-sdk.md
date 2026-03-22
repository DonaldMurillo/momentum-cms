# Client SDK

The Momentum code generator can produce a framework-agnostic, fully typed API client that uses `fetch` under the hood.

## Generate the Client

Pass the `--client` flag to the generator:

```bash
npm run generate -- --client src/generated/momentum.client.ts
```

This creates a self-contained TypeScript file that imports types from your generated types file.

## Usage

```typescript
import { createMomentumClient } from './generated/momentum.client';

const client = createMomentumClient({
	baseUrl: 'http://localhost:4200',
	auth: { type: 'cookie' }, // or 'apiKey' / 'bearer'
});

// Find all posts
const result = await client.posts.find({ limit: 10, page: 1 });
console.log(result.docs); // fully typed as Posts[]

// Find by ID
const post = await client.posts.findById('abc-123');

// Create
const newPost = await client.posts.create({ title: 'Hello World' });

// Update
const updated = await client.posts.update('abc-123', { title: 'Updated' });

// Delete
const deleted = await client.posts.delete('abc-123');
```

## Authentication

The client supports three auth modes:

```typescript
// Cookie-based (browser sessions, includes credentials automatically)
{ auth: { type: 'cookie' } }

// API key
{ auth: { type: 'apiKey', key: 'your-api-key' } }

// Bearer token
{ auth: { type: 'bearer', token: 'your-jwt-token' } }
```

## Globals

Globals are accessed as read/update singletons:

```typescript
const settings = await client.globals.siteSettings.get();
await client.globals.siteSettings.update({ siteName: 'My Site' });
```

## Configuration

```typescript
const client = createMomentumClient({
	baseUrl: 'https://api.example.com',
	auth: { type: 'bearer', token: 'xxx' },
	headers: { 'X-Custom': 'value' }, // Additional headers
	fetch: customFetchFn, // Custom fetch implementation (e.g., for SSR)
});
```

## Error Handling

The client throws `MomentumClientError` for HTTP errors:

```typescript
import { MomentumClientError } from './generated/momentum.client';

try {
	await client.posts.create({ title: '' });
} catch (error) {
	if (error instanceof MomentumClientError) {
		console.log(error.status); // HTTP status code
		console.log(error.fieldErrors); // [{ field: 'title', message: '...' }]
	}
}
```

## Query Options

### `find(options?)`

| Option        | Type                      | Description                           |
| ------------- | ------------------------- | ------------------------------------- |
| `where`       | `Record<string, unknown>` | Filter criteria                       |
| `sort`        | `string`                  | Sort field (prefix with `-` for desc) |
| `limit`       | `number`                  | Results per page                      |
| `page`        | `number`                  | Page number                           |
| `depth`       | `number`                  | Relationship population depth         |
| `withDeleted` | `boolean`                 | Include soft-deleted documents        |
| `onlyDeleted` | `boolean`                 | Return only soft-deleted documents    |

### `findById(id, options?)`

| Option        | Type      | Description                    |
| ------------- | --------- | ------------------------------ |
| `depth`       | `number`  | Relationship population depth  |
| `withDeleted` | `boolean` | Include soft-deleted documents |

## Security

- All URL path segments (slugs and IDs) are encoded with `encodeURIComponent` to prevent path traversal
- Import paths and generated code use `JSON.stringify` to prevent string breakout
- Object keys are safely quoted when they contain special characters

## Related

- [Quick Start](quick-start.md) -- Set up a new project
- [REST API](../server/rest-api.md) -- Full endpoint reference
- [API Service](../admin/api-service.md) -- Angular admin API client (`injectMomentumAPI`)
