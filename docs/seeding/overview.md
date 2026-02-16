# Seeding

Momentum CMS includes a seeding system for populating your database with initial data, test data, or default content.

## Configuration

```typescript
import { defineMomentumConfig } from '@momentumcms/core';

export default defineMomentumConfig({
	seeding: {
		defaults: ({ admin, user, collection }) => [
			admin({ email: 'admin@example.com', password: 'admin123', role: 'admin' }),
			user({ email: 'editor@example.com', password: 'editor123', role: 'editor' }),
			collection('posts')
				.doc({ title: 'Welcome', content: 'Hello world' })
				.doc({ title: 'Getting Started', content: 'Your first post' }),
		],
		seed: async (context) => {
			// Custom seeding logic with full API access
		},
	},
});
```

## Seed Sections

### `defaults(helpers)`

Declarative seed definitions using helper builders. Runs before `seed()`. Supports conflict detection and idempotent re-runs.

### `seed(context)`

Imperative seeding with full API access. Runs after `defaults()`. Use for complex seeding logic.

## Default Entity Helpers

The `defaults` function receives builder helpers:

### `admin(data)`

Create an admin user:

```typescript
admin({
	email: 'admin@example.com',
	password: 'admin123',
	role: 'admin',
	name: 'Admin User',
});
```

### `user(data)`

Create a regular user:

```typescript
user({
	email: 'user@example.com',
	password: 'user123',
	role: 'editor',
});
```

### `authUser(data)`

Create a Better Auth user (lower-level, for custom auth setups):

```typescript
authUser({
	email: 'custom@example.com',
	password: 'pass123',
});
```

### `collection<T>(slug)`

Fluent builder for seeding collection documents:

```typescript
collection('posts')
	.doc({ title: 'Post 1', status: 'published' })
	.doc({ title: 'Post 2', status: 'draft' })
	.options({ onConflict: 'skip' });
```

## Seed Entity Options

```typescript
interface SeedEntityOptions {
	onConflict?: 'skip' | 'update' | 'error'; // Default: 'skip'
	conflictFields?: string[]; // Fields to check for conflicts
}
```

| Strategy | Behavior                                   |
| -------- | ------------------------------------------ |
| `skip`   | Skip if a matching document already exists |
| `update` | Update existing document with seed data    |
| `error`  | Throw `SeedConflictError`                  |

## SeedContext

The `seed()` function receives a context object:

```typescript
interface SeedContext {
	api: MomentumAPI;
	config: MomentumConfig;
	logger: Logger;
	seeded: Map<string, SeededDocument[]>; // Documents created by defaults()
}
```

Use `context.seeded` to reference documents created by `defaults()`:

```typescript
seed: async (context) => {
	const adminDocs = context.seeded.get('admin') ?? [];
	const adminId = adminDocs[0]?.id;

	await context.api.create('posts', {
		title: 'Admin Post',
		author: adminId,
	});
};
```

## Seed Tracking

Momentum tracks which seeds have been applied to prevent re-running on subsequent startups. Seed entities are identified by their conflict fields.

## Error Types

| Error               | When                                               |
| ------------------- | -------------------------------------------------- |
| `SeedConflictError` | `onConflict: 'error'` and matching document exists |
| `SeedRollbackError` | Seed transaction failed and was rolled back        |

## Related

- [Collection Overview](../collections/overview.md) — Collection definitions
- [Auth Configuration](../auth/configuration.md) — User creation
