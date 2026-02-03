# Momentum API

Direct database access API for Momentum CMS.

## Overview

The Momentum API provides a unified interface for data operations that works seamlessly in both server-side rendering (SSR) and browser contexts. On the server, it accesses the database directly for optimal performance. In the browser, it automatically falls back to HTTP API calls.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Angular Component                     │
│                    const api = injectMomentumAPI()          │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │        Platform Detection        │
         │     isPlatformServer(platformId) │
         └────────────────┬────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
┌───────────────────┐             ┌───────────────────┐
│   SSR (Server)    │             │     Browser       │
│ ServerMomentumAPI │             │ BrowserMomentumAPI│
│ Direct DB access  │             │ HTTP calls /api/* │
└─────────┬─────────┘             └───────────────────┘
          │
          ▼
┌───────────────────┐
│  MomentumAPI      │  ← Singleton
│ (Database direct) │
└───────────────────┘
```

## Quick Start

### In Angular Components

```typescript
import { injectMomentumAPI } from '@momentum-cms/admin';
import type { Post } from '../types/momentum.generated';

@Component({
	selector: 'app-posts',
	template: `
		@for (post of posts(); track post.id) {
			<article>
				<h2>{{ post.title }}</h2>
			</article>
		}
	`,
})
export class PostsComponent {
	private readonly api = injectMomentumAPI();
	readonly posts = signal<Post[]>([]);

	constructor() {
		this.loadPosts();
	}

	async loadPosts(): Promise<void> {
		const result = await this.api.collection<Post>('posts').find({ limit: 10 });
		this.posts.set(result.docs);
	}
}
```

### Server-Side (Express/Node)

```typescript
import { getMomentumAPI } from '@momentum-cms/server-core';

// After initialization
const api = getMomentumAPI();
const posts = await api.collection('posts').find({ limit: 10 });
```

## API Reference

### Initialization Functions

#### `initializeMomentumAPI(config)`

Initialize the Momentum API singleton. Call once at server startup.

```typescript
import { initializeMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from './momentum.config';

initializeMomentumAPI(momentumConfig);
```

#### `getMomentumAPI()`

Get the initialized singleton instance. Throws if not initialized.

```typescript
const api = getMomentumAPI();
```

#### `isMomentumAPIInitialized()`

Check if the API has been initialized.

```typescript
if (!isMomentumAPIInitialized()) {
	initializeMomentumAPI(config);
}
```

### Angular Injection

#### `injectMomentumAPI()`

Inject the Momentum API with automatic platform detection. Works in both SSR and browser contexts.

```typescript
@Component({...})
export class MyComponent {
  private readonly api = injectMomentumAPI();
}
```

### Collection Operations

All operations are available in both Promise and Observable variants.

| Method             | Returns                  | Description                     |
| ------------------ | ------------------------ | ------------------------------- |
| `find(options?)`   | `Promise<FindResult<T>>` | Query documents with pagination |
| `findById(id)`     | `Promise<T \| null>`     | Get a single document by ID     |
| `create(data)`     | `Promise<T>`             | Create a new document           |
| `update(id, data)` | `Promise<T>`             | Update an existing document     |
| `delete(id)`       | `Promise<DeleteResult>`  | Delete a document               |
| `count(where?)`    | `Promise<number>`        | Count matching documents        |

#### Observable Variants (Angular)

All methods have `$` suffixed observable variants for Angular's reactive patterns:

- `find$()`, `findById$()`, `create$()`, `update$()`, `delete$()`

```typescript
// Using observables
this.api
	.collection<Post>('posts')
	.find$({ limit: 10 })
	.subscribe((result) => {
		this.posts.set(result.docs);
	});

// Using promises (async/await)
const result = await this.api.collection<Post>('posts').find({ limit: 10 });
```

### Find Options

```typescript
interface FindOptions {
	where?: Record<string, unknown>; // Filter conditions
	sort?: string; // Sort field (prefix with - for desc)
	limit?: number; // Max results (default: 10)
	page?: number; // Page number (default: 1)
	depth?: number; // Relationship population depth
}
```

### Find Result

```typescript
interface FindResult<T> {
	docs: T[]; // Array of documents
	totalDocs: number; // Total matching documents
	totalPages: number; // Total pages
	page: number; // Current page
	limit: number; // Documents per page
	hasNextPage: boolean;
	hasPrevPage: boolean;
	nextPage?: number;
	prevPage?: number;
}
```

## Context and Access Control

The API supports user context for access control:

```typescript
// On server
const api = getMomentumAPI();
const adminApi = api.setContext({ user: currentUser });
const posts = await adminApi.collection('posts').find();
```

During SSR, context is automatically provided by Express:

```typescript
// In server.ts
app.use('/**', (req, res, next) => {
	angularApp.handle(req, {
		providers: [
			{ provide: MOMENTUM_API, useValue: getMomentumAPI() },
			{ provide: MOMENTUM_API_CONTEXT, useValue: { user: req.momentumUser } },
		],
	});
});
```

## Type Generation

Generate TypeScript types from your collection definitions:

```bash
# One-time generation
nx run example-angular:generate-types

# Watch mode
nx run example-angular:generate-types --watch
```

### Generated Types

```typescript
// src/types/momentum.generated.ts (auto-generated)

export interface Post {
	id: string;
	title: string;
	content?: string;
	status?: 'draft' | 'published';
	createdAt: string;
	updatedAt: string;
}

export interface MomentumCollections {
	posts: Post;
	users: User;
}

export type CollectionSlug = 'posts' | 'users';
```

### Using Generated Types

```typescript
import type { Post, User, CollectionSlug } from '../types/momentum.generated';

const api = injectMomentumAPI();

// Fully typed operations
const posts = await api.collection<Post>('posts').find();
const user = await api.collection<User>('users').findById('123');
```

## Error Handling

The API throws specific error types:

```typescript
import {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	ValidationError,
} from '@momentum-cms/server-core';

try {
	await api.collection('posts').create({ title: '' });
} catch (error) {
	if (error instanceof ValidationError) {
		console.error('Validation failed:', error.errors);
	} else if (error instanceof AccessDeniedError) {
		console.error('Access denied');
	}
}
```

## Server Setup

### Express Integration

```typescript
// server.ts
import { initializeMomentumAPI, getMomentumAPI } from '@momentum-cms/server-core';
import { MOMENTUM_API, MOMENTUM_API_CONTEXT } from '@momentum-cms/admin';

// Initialize at startup
initializeMomentumAPI(momentumConfig);

// Pass to Angular SSR
app.use('/**', (req, res, next) => {
	angularApp.handle(req, {
		providers: [
			{ provide: MOMENTUM_API, useValue: getMomentumAPI() },
			{ provide: MOMENTUM_API_CONTEXT, useValue: { user: req.momentumUser } },
		],
	});
});
```

## Best Practices

1. **Use generated types** - Run type generation and import types for full type safety
2. **Prefer promises in effects** - Use async/await in effects for cleaner code
3. **Handle errors** - Catch specific error types for proper error handling
4. **Use context** - Pass user context for access control in protected operations
5. **Paginate large queries** - Always use `limit` and `page` for large collections
