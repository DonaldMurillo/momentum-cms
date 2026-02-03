# Seeding

Declarative data seeding system for Momentum CMS with strict typing and IntelliSense support.

## Overview

The seeding system allows you to define initial data for your application in a type-safe, idempotent way. Seeds are tracked internally to prevent duplicates and enable change detection across server restarts.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    momentum.config.ts                         │
│                  seeding: { defaults, seed }                  │
└────────────────────────────┬─────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌─────────────────────┐                ┌─────────────────────┐
│   defaults()        │                │   seed()            │
│ Typed helpers       │                │ Custom function     │
│ Ordered execution   │─── runs first ─│ Dependency access   │
└─────────────────────┘                └─────────────────────┘
         │                                       │
         └───────────────────┬───────────────────┘
                             ▼
         ┌─────────────────────────────────────────┐
         │           Seed Executor                  │
         │  • Check existing seeds via tracker     │
         │  • Apply onConflict strategy            │
         │  • Calculate checksums for change detection │
         └────────────────────────┬────────────────┘
                                  │
         ┌────────────────────────┴────────────────┐
         ▼                                         ▼
┌─────────────────────┐                  ┌─────────────────────┐
│  Target Collection  │                  │  _momentum_seeds    │
│  (posts, users...)  │                  │  Internal tracking  │
└─────────────────────┘                  └─────────────────────┘
```

## Quick Start

### Basic Configuration

```typescript
// momentum.config.ts
import { defineMomentumConfig } from '@momentum-cms/core';
import { sqliteAdapter } from '@momentum-cms/db-drizzle';
import { Posts, Users } from './collections';

export default defineMomentumConfig({
	db: { adapter: sqliteAdapter({ filename: './data/momentum.db' }) },
	collections: [Posts, Users],

	seeding: {
		// Default entities - created first, in order
		defaults: ({ admin, user, collection }) => [
			// Create the first admin user
			admin('first-admin', {
				name: 'System Admin',
				email: 'admin@example.com',
			}),

			// Create a regular user
			user('demo-user', {
				name: 'Demo User',
				email: 'demo@example.com',
			}),

			// Create typed collection data
			collection<PostDoc>('posts').create('welcome-post', {
				title: 'Welcome to Momentum CMS!',
				status: 'published',
			}),
		],

		options: {
			onConflict: 'skip', // Default behavior
			runOnStart: 'development', // Only seed in development
		},
	},
});
```

### With Custom Seed Function

For complex scenarios requiring relationships between seeded entities:

```typescript
seeding: {
	defaults: ({ admin }) => [
		admin('first-admin', { name: 'Admin', email: 'admin@example.com' }),
	],

	seed: async (ctx) => {
		// Get the previously seeded admin user
		const admin = await ctx.getSeeded('first-admin');

		// Create a post referencing the admin
		await ctx.seed({
			seedId: 'admin-welcome-post',
			collection: 'posts',
			data: {
				title: 'Welcome from Admin',
				authorId: admin?.id,
				status: 'published',
			},
		});

		ctx.log('Custom seeding complete!');
	},
},
```

## Helper Methods

The `defaults` function receives typed helpers for creating seed entities:

### `admin(seedId, data, options?)`

Create the first admin user with sensible defaults:

- `role` defaults to `'admin'`
- `emailVerified` defaults to `true` (pre-verified)

```typescript
admin('first-admin', {
	name: 'System Admin',
	email: 'admin@example.com',
	image: 'https://example.com/admin.png', // Optional
});

// Override defaults if needed
admin('super-admin', {
	name: 'Super Admin',
	email: 'super@example.com',
	role: 'superadmin', // Custom role
	emailVerified: false, // Not pre-verified
});
```

### `user(seedId, data, options?)`

Create a regular user:

- `role` defaults to `'user'`
- `emailVerified` defaults to `false`

```typescript
user('regular-user', {
	name: 'John Doe',
	email: 'john@example.com',
});

// With custom options
user('verified-user', {
	name: 'Jane Doe',
	email: 'jane@example.com',
	emailVerified: true,
	role: 'editor',
});
```

### `collection<T>(slug).create(seedId, data, options?)`

Create typed seed entities for any collection:

```typescript
interface PostDoc {
	title: string;
	content?: string;
	status: 'draft' | 'published';
	authorId?: string;
}

// Full IntelliSense for PostDoc fields
collection<PostDoc>('posts').create('welcome-post', {
	title: 'Welcome!',
	status: 'published',
});

// Partial data is allowed - missing fields use collection defaults
collection<PostDoc>('posts').create('draft-post', {
	title: 'Work in Progress',
});
```

## Seed Context

The custom `seed` function receives a `SeedContext` with these utilities:

### `getSeeded<T>(seedId)`

Look up a previously seeded document by its seed ID:

```typescript
seed: async (ctx) => {
	const admin = await ctx.getSeeded<UserDoc>('first-admin');
	if (admin) {
		console.log('Admin ID:', admin.id);
		console.log('Admin data:', admin.data);
	}
},
```

### `seed<T>(entity)`

Create a new seed entity with tracking:

```typescript
seed: async (ctx) => {
	const result = await ctx.seed({
		seedId: 'custom-post',
		collection: 'posts',
		data: { title: 'Created in custom function' },
	});

	console.log('Action taken:', result.action); // 'created' | 'updated' | 'skipped'
	console.log('Document ID:', result.id);
},
```

### `log(message)`

Log a message (respects the `quiet` option):

```typescript
seed: async (ctx) => {
	ctx.log('Starting custom seeding...');
	// ... seeding logic
	ctx.log('Custom seeding complete!');
},
```

## Configuration Options

### `SeedingOptions`

| Option       | Type                                   | Default         | Description                         |
| ------------ | -------------------------------------- | --------------- | ----------------------------------- |
| `onConflict` | `'skip' \| 'update' \| 'error'`        | `'skip'`        | Default conflict handling strategy  |
| `runOnStart` | `boolean \| 'development' \| 'always'` | `'development'` | When to run seeding on server start |
| `quiet`      | `boolean`                              | `false`         | Suppress seeding log messages       |

### `SeedEntityOptions`

Per-entity options that override global settings:

| Option              | Type                            | Default | Description                              |
| ------------------- | ------------------------------- | ------- | ---------------------------------------- |
| `onConflict`        | `'skip' \| 'update' \| 'error'` | -       | Override conflict handling for this seed |
| `skipHooks`         | `boolean`                       | `false` | Skip lifecycle hooks during seeding      |
| `skipAccessControl` | `boolean`                       | `true`  | Skip access control checks               |

Example with per-entity options:

```typescript
defaults: ({ user, collection }) => [
	// Always skip this seed if it exists
	user('admin', { name: 'Admin', email: 'admin@example.com' }, { onConflict: 'skip' }),

	// Update this seed if data changed
	collection<PostDoc>('posts').create(
		'welcome',
		{ title: 'Welcome!', content: 'Updated content' },
		{ onConflict: 'update' },
	),

	// Throw an error if this seed already exists
	collection<SettingsDoc>('settings').create(
		'global-settings',
		{ siteName: 'My Site' },
		{ onConflict: 'error' },
	),
],
```

## Conflict Handling

### `onConflict: 'skip'` (default)

If a seed ID already exists, skip it without modification:

```
Run 1: first-admin → Created ✓
Run 2: first-admin → Skipped (already exists)
Run 3: first-admin → Skipped (already exists)
```

### `onConflict: 'update'`

Update the document only if the seed data has changed (detected via checksum):

```
Run 1: welcome-post (title: 'Hello') → Created ✓
Run 2: welcome-post (title: 'Hello') → Skipped (no changes)
Run 3: welcome-post (title: 'Hello World!') → Updated ✓
```

### `onConflict: 'error'`

Throw a `SeedConflictError` if the seed ID already exists:

```typescript
import { SeedConflictError } from '@momentum-cms/core';

try {
	await runSeeding(config, adapter);
} catch (error) {
	if (error instanceof SeedConflictError) {
		console.error(`Seed "${error.seedId}" already exists in "${error.collection}"`);
	}
}
```

## Execution Flow

1. **Server starts** → `initializeMomentumAPI(config)`
2. **Database initialized** → `_momentum_seeds` table created
3. **Check if seeding should run** → Based on `runOnStart` option
4. **Process `defaults` array in order**:
   - For each entity: check if `seedId` exists in tracker
   - If exists: apply `onConflict` strategy
   - If new: create document, record in tracker with checksum
5. **Run custom `seed()` function** with `SeedContext`
6. **Seeding complete** → Log summary

## Idempotency

Seeds are idempotent by design:

- Each seed has a unique `seedId` tracked in `_momentum_seeds`
- Checksums (SHA-256) detect data changes for `onConflict: 'update'`
- Multiple server restarts with the same config produce the same result

## Internal Tracking

The seeding system uses an internal `_momentum_seeds` table:

```sql
CREATE TABLE IF NOT EXISTS "_momentum_seeds" (
  id TEXT PRIMARY KEY,
  seedId TEXT NOT NULL UNIQUE,
  collection TEXT NOT NULL,
  documentId TEXT NOT NULL,
  checksum TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
)
```

Fields:

- `id` - Auto-generated UUID
- `seedId` - User-provided unique identifier
- `collection` - Target collection slug
- `documentId` - Actual document ID in target collection
- `checksum` - SHA-256 hash of seed data for change detection
- `createdAt/updatedAt` - Timestamps

## Type Definitions

### `SeedEntity<T>`

```typescript
interface SeedEntity<TData = Record<string, unknown>> {
	seedId: string; // Unique identifier
	collection: string; // Collection slug
	data: TData; // Document data
	options?: SeedEntityOptions;
}
```

### `SeededDocument<T>`

Result of a seeding operation:

```typescript
interface SeededDocument<T = Record<string, unknown>> {
	id: string; // Database document ID
	seedId: string; // The seed ID
	collection: string; // Collection slug
	data: T; // The document data
	action: 'created' | 'updated' | 'skipped';
}
```

### `SeedingResult`

Summary returned from `runSeeding()`:

```typescript
interface SeedingResult {
	total: number; // Total seeds processed
	created: number; // New documents created
	updated: number; // Documents updated
	skipped: number; // Seeds skipped
	seeds: SeededDocument[]; // All seeded documents
}
```

## Best Practices

1. **Use descriptive seed IDs** - `first-admin`, `welcome-post`, `default-settings`
2. **Order matters** - Put dependencies before dependents in `defaults`
3. **Use `admin()` for first user** - Gets admin role and verified email by default
4. **Use typed helpers** - `collection<T>()` provides full IntelliSense
5. **Prefer `onConflict: 'skip'`** - Safe for production, won't overwrite manual changes
6. **Use custom function for relationships** - `getSeeded()` resolves dependencies
7. **Run in development only** - Default `runOnStart: 'development'` is safest

## Example: Complete Setup

```typescript
// types/collections.ts
interface PostDoc {
	title: string;
	content?: string;
	status: 'draft' | 'published';
	authorId?: string;
}

interface SettingsDoc {
	siteName: string;
	siteDescription?: string;
	maintenanceMode: boolean;
}

// momentum.config.ts
import { defineMomentumConfig } from '@momentum-cms/core';

export default defineMomentumConfig({
	// ... db and collections config

	seeding: {
		defaults: ({ admin, user, collection }) => [
			// 1. First admin user (verified, admin role)
			admin('first-admin', {
				name: 'System Administrator',
				email: 'admin@company.com',
			}),

			// 2. Demo user for testing
			user('demo-user', {
				name: 'Demo User',
				email: 'demo@company.com',
				emailVerified: true,
			}),

			// 3. Welcome content
			collection<PostDoc>('posts').create('welcome-post', {
				title: 'Welcome to Our Platform',
				content: 'This is your first post...',
				status: 'published',
			}),

			// 4. Site settings
			collection<SettingsDoc>('settings').create(
				'global-settings',
				{
					siteName: 'My Awesome Site',
					siteDescription: 'Built with Momentum CMS',
					maintenanceMode: false,
				},
				{ onConflict: 'update' }, // Allow settings updates
			),
		],

		seed: async (ctx) => {
			// Get admin for relationship
			const admin = await ctx.getSeeded('first-admin');

			// Create admin's first post
			if (admin) {
				await ctx.seed({
					seedId: 'admin-first-post',
					collection: 'posts',
					data: {
						title: 'Getting Started Guide',
						content: 'Here is how to use the platform...',
						status: 'published',
						authorId: admin.id,
					},
				});
			}

			ctx.log('All custom seeds created!');
		},

		options: {
			onConflict: 'skip',
			runOnStart: 'development',
			quiet: false,
		},
	},
});
```
