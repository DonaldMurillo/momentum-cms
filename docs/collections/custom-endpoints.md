# Custom Endpoints

Add custom API routes to any collection.

## Configuration

```typescript
export const Posts = defineCollection({
	slug: 'posts',
	endpoints: [
		{
			path: '/search',
			method: 'get',
			handler: async ({ req, collection, query }) => {
				const results = await query.find('posts', { limit: 20 });
				return { status: 200, body: results };
			},
		},
		{
			path: '/bulk-publish',
			method: 'post',
			handler: async ({ req, body, query }) => {
				const ids = body?.ids as string[];
				// Use transactions for atomic operations
				await query.transaction(async (tx) => {
					for (const id of ids) {
						await tx.update('posts', id, { status: 'published' });
					}
				});
				return { status: 200, body: { published: ids.length } };
			},
		},
	],
	fields: [],
});
```

## Endpoint Config

```typescript
interface EndpointConfig {
	path: string; // Route path (e.g., '/search')
	method: 'get' | 'post' | 'put' | 'patch' | 'delete';
	handler: (args: EndpointArgs) => Promise<EndpointResponse>;
}
```

## Handler Arguments

```typescript
interface EndpointArgs {
	req: { user?; headers? }; // Request context
	collection: CollectionConfig; // This collection's config
	body?: Record<string, unknown>; // Request body (POST/PUT/PATCH)
	query: EndpointQueryHelper; // Query any collection
}
```

## Query Helper

The `query` object lets you perform CRUD operations on any collection:

```typescript
interface EndpointQueryHelper {
	find(slug, options?): Promise<{ docs; totalDocs }>;
	findById(slug, id): Promise<Record<string, unknown> | null>;
	count(slug): Promise<number>;
	create(slug, data): Promise<Record<string, unknown>>;
	update(slug, id, data): Promise<Record<string, unknown>>;
	delete(slug, id): Promise<{ id; deleted }>;
	transaction<T>(callback: (query) => Promise<T>): Promise<T>;
}
```

## Response

```typescript
interface EndpointResponse {
	status: number;
	body: unknown;
}
```

## Transactions

Wrap multiple operations in a transaction for atomicity:

```typescript
handler: async ({ query }) => {
	const result = await query.transaction(async (tx) => {
		const post = await tx.create('posts', { title: 'New Post' });
		await tx.create('audit-log', { action: 'create', postId: post.id });
		return post;
	});
	return { status: 201, body: result };
};
```

Falls back to non-transactional execution if the database adapter doesn't support transactions.

## Route Registration

Custom endpoints are registered at `/api/:collection/:path`. For example:

- Collection slug: `posts`, path: `/search` → `GET /api/posts/search`
- Collection slug: `posts`, path: `/bulk-publish` → `POST /api/posts/bulk-publish`

## Related

- [REST API](../server/rest-api.md) — Built-in endpoints
- [Hooks](hooks.md) — Lifecycle hooks (alternative for simpler logic)
