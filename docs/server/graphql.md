# GraphQL

Momentum CMS auto-generates a GraphQL schema from your collections.

## Configuration

GraphQL is configured per collection:

```typescript
export const Posts = defineCollection({
	slug: 'posts',
	graphQL: {
		singularName: 'post',
		pluralName: 'posts',
		disableQueries: false,
		disableMutations: false,
	},
	fields: [],
});
```

## Generated Schema

Each collection generates:

- **Query**: `post(id: ID!)`, `posts(limit: Int, page: Int, sort: String)`
- **Mutation**: `createPost(data: PostInput!)`, `updatePost(id: ID!, data: PostInput!)`, `deletePost(id: ID!)`
- **Types**: Auto-generated from field definitions

## Disabling

Disable queries or mutations per collection:

```typescript
graphQL: {
  disableQueries: true,   // No read queries
  disableMutations: true,  // No write mutations
}
```

## Related

- [REST API](rest-api.md) — REST endpoints (alternative)
- [Collection Overview](../collections/overview.md) — GraphQL config options
