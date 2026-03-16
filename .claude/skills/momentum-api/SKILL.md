---
name: momentum-api
description: Work with Momentum API for data operations in Angular components
argument-hint: <operation> [collection]
---

# Momentum API Usage

Guide for using `injectMomentumAPI()` in Angular components.

**Key rules**: Always use async/await (never subscribe). Always use `instanceof` checks for DOM elements (never `as` type assertions). Always use typed error classes for error handling.

## Arguments

- `$ARGUMENTS` - Operation type: "query", "crud", "typed", or collection name

## Quick Reference

### Inject the API

```typescript
import { injectMomentumAPI } from '@momentumcms/admin';

@Component({...})
export class MyComponent {
  private readonly api = injectMomentumAPI();
}
```

### Query Data (async/await — the only correct pattern)

Always use async/await with `.find()` and `.findById()`. Never use `.find$().subscribe()` or any Observable pattern.

```typescript
async loadData(): Promise<void> {
  const result = await this.api.collection<Post>('posts').find({ limit: 10 });
  this.posts.set(result.docs);
}
```

### Single Document Lookup

Use `.findById()` to fetch a single document by ID:

```typescript
async loadPost(id: string): Promise<void> {
  const post = await this.api.collection<Post>('posts').findById(id);
  this.post.set(post);
}
```

### CRUD Operations

```typescript
// Create
const post = await this.api.collection<Post>('posts').create({ title: 'New Post' });

// Read single document
const post = await this.api.collection<Post>('posts').findById('123');

// Update
const updated = await this.api.collection<Post>('posts').update('123', { title: 'Updated' });

// Delete
const result = await this.api.collection<Post>('posts').delete('123');
```

### With Generated Types

1. Generate types: `nx run example-angular:generate-types`
2. Import and use:

```typescript
import type { Post, User } from '../types/momentum.generated';

const posts = await this.api.collection<Post>('posts').find();
const users = await this.api.collection<User>('users').find();
```

## Find Options

Always pass `FindOptions` to `.find()` to control queries. All fields are optional:

```typescript
interface FindOptions {
	where?: Record<string, unknown>; // Filter conditions (see examples below)
	sort?: string; // Sort field (prefix with - for desc, e.g. '-createdAt')
	limit?: number; // Max results (default: 10)
	page?: number; // Page number (default: 1)
	depth?: number; // Relationship population depth
	transfer?: boolean; // TransferState caching (default: true)
}
```

### FindOptions Usage Examples

```typescript
// Filter by field value
const published = await this.api.collection<Post>('posts').find({
	where: { status: { equals: 'published' } },
	limit: 20,
	sort: '-createdAt',
	page: 1,
});

// Paginated query
const page2 = await this.api.collection<Post>('posts').find({
	limit: 10,
	page: 2,
	sort: 'title',
});

// Combined filters
const filtered = await this.api.collection<Post>('posts').find({
	where: { category: { equals: categoryId }, _status: { equals: 'published' } },
	limit: 50,
	sort: '-createdAt',
});
```

## Do / Don't

### DOM Access — never use `as` type assertions

```typescript
// DON'T — causes @typescript-eslint/consistent-type-assertions lint failure
async handleSubmit(event: Event): Promise<void> {
  const form = event.target as HTMLFormElement;          // LINT ERROR
  const input = form.querySelector('input') as HTMLInputElement; // LINT ERROR
}

// DO — use instanceof narrowing
async handleSubmit(event: Event): Promise<void> {
  event.preventDefault();
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) return;
  const input = target.querySelector('input');
  if (!(input instanceof HTMLInputElement)) return;

  const post = await this.api.collection<Post>('posts').create({
    title: input.value,
  });
  this.posts.update((posts) => [post, ...posts]);
  input.value = '';
}
```

### Data Fetching — always use async/await, never subscribe

```typescript
// DON'T — Observable subscribe pattern
this.api
	.collection<Post>('posts')
	.find$({ limit: 10 })
	.subscribe((result) => {
		this.posts.set(result.docs);
	});

// DO — async/await pattern
const result = await this.api.collection<Post>('posts').find({ limit: 10 });
this.posts.set(result.docs);
```

### Error Handling — always use typed error classes

```typescript
// DON'T — generic catch with no typed handling
try {
	await this.api.collection('posts').create(data);
} catch (e) {
	console.error(e);
}

// DO — import and check typed error classes from @momentumcms/server-core
import {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	ValidationError,
} from '@momentumcms/server-core';

try {
	await this.api.collection<Post>('posts').create(data);
} catch (error) {
	if (error instanceof ValidationError) {
		// error.errors is FieldValidationError[] with { field, message }
		this.validationErrors.set(error.errors);
	} else if (error instanceof DocumentNotFoundError) {
		this.notFound.set(true);
	} else if (error instanceof AccessDeniedError) {
		this.accessDenied.set(true);
	}
}
```

## Full Component Example

```typescript
import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { injectMomentumAPI } from '@momentumcms/admin';
import { ValidationError, DocumentNotFoundError } from '@momentumcms/server-core';
import type { Post } from '../types/momentum.generated';

@Component({
	selector: 'app-posts',
	template: `
		@if (loading()) {
			<p>Loading...</p>
		} @else if (error()) {
			<p>{{ error() }}</p>
		} @else {
			@for (post of posts(); track post.id) {
				<article>
					<h2>{{ post.title }}</h2>
					<p>{{ post.content }}</p>
					<button (click)="deletePost(post.id)">Delete</button>
				</article>
			}
		}

		<form (submit)="createPost($event)">
			<input #titleInput placeholder="Title" />
			<button type="submit">Create Post</button>
		</form>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostsComponent {
	private readonly api = injectMomentumAPI();

	readonly posts = signal<Post[]>([]);
	readonly loading = signal(true);
	readonly error = signal<string | null>(null);

	constructor() {
		void this.loadPosts();
	}

	async loadPosts(): Promise<void> {
		this.loading.set(true);
		try {
			const result = await this.api.collection<Post>('posts').find({
				limit: 20,
				sort: '-createdAt',
				where: { _status: { equals: 'published' } },
			});
			this.posts.set(result.docs);
		} catch (error) {
			if (error instanceof DocumentNotFoundError) {
				this.error.set('Posts collection not found.');
			} else {
				this.error.set('Failed to load posts.');
			}
		} finally {
			this.loading.set(false);
		}
	}

	async createPost(event: Event): Promise<void> {
		event.preventDefault();
		const target = event.target;
		if (!(target instanceof HTMLFormElement)) return;
		const input = target.querySelector('input');
		if (!(input instanceof HTMLInputElement)) return;

		try {
			const post = await this.api.collection<Post>('posts').create({
				title: input.value,
			});
			this.posts.update((posts) => [post, ...posts]);
			input.value = '';
		} catch (error) {
			if (error instanceof ValidationError) {
				console.error('Validation failed:', error.errors);
			}
		}
	}

	async deletePost(id: string): Promise<void> {
		await this.api.collection<Post>('posts').delete(id);
		this.posts.update((posts) => posts.filter((p) => p.id !== id));
	}
}
```

## Error Handling

Import typed error classes from `@momentumcms/server-core` and use `instanceof` to handle specific errors:

```typescript
import {
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	ValidationError,
} from '@momentumcms/server-core';

try {
	await this.api.collection<Post>('posts').findById(id);
} catch (error) {
	if (error instanceof DocumentNotFoundError) {
		// Document with given ID does not exist
		this.notFound.set(true);
	} else if (error instanceof AccessDeniedError) {
		// Current user lacks permission
		this.accessDenied.set(true);
	} else if (error instanceof ValidationError) {
		// error.errors: Array<{ field: string; message: string }>
		this.validationErrors.set(error.errors);
	} else if (error instanceof CollectionNotFoundError) {
		// Collection slug is invalid
		this.error.set('Invalid collection');
	}
}
```

### Available Error Classes

| Error Class               | When Thrown                         | Useful Properties              |
| ------------------------- | ----------------------------------- | ------------------------------ |
| `ValidationError`         | Create/update with invalid data     | `errors: { field, message }[]` |
| `DocumentNotFoundError`   | `findById` with non-existent ID     | `message`                      |
| `AccessDeniedError`       | User lacks permission for operation | `message`                      |
| `CollectionNotFoundError` | Invalid collection slug             | `message`                      |
| `GlobalNotFoundError`     | Invalid global slug                 | `message`                      |

## Platform Behavior

- **SSR**: Direct database access (no HTTP overhead)
- **Browser**: HTTP calls to `/api/*`
- **Same interface** - code works identically on both platforms

## Type Generation

Generate types from your collections:

```bash
# Generate types
nx run example-angular:generate-types

# Watch mode (auto-regenerate on changes)
nx run example-angular:generate-types --watch
```

Output file: `src/types/momentum.generated.ts`

## TransferState (SSR Hydration)

TransferState is **enabled by default** for all read operations (`find`, `findById`, `findSignal`, `findByIdSignal`). Data fetched during SSR is automatically cached and reused on browser hydration, eliminating duplicate HTTP calls.

### Default Behavior (TransferState enabled)

```typescript
// SSR: Fetches and caches | Browser: Reads from cache (no HTTP)
const posts = await this.api.collection<Post>('posts').find({ limit: 10 });
const post = await this.api.collection<Post>('posts').findById(id);
```

### Opt-out

Use `transfer: false` to disable TransferState for a specific call:

```typescript
// Always makes HTTP call on browser (no caching)
const posts = await this.api.collection<Post>('posts').find({
	limit: 10,
	transfer: false,
});
```

### Signal Methods

```typescript
// Signals also use TransferState by default
readonly posts = this.api.collection<Post>('posts').findSignal({ limit: 10 });
readonly post = this.api.collection<Post>('posts').findByIdSignal(id);
```

### Requirements

Ensure `provideClientHydration()` is in your app config:

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
	providers: [provideClientHydration()],
};
```

<!--
## Changes from previous version and why:

1. REMOVED "Query Data (Observables)" section entirely — it showed `.find$().subscribe()` which contradicts the preferred async/await pattern and confused agents into using subscribe.

2. FIXED full component example — replaced `as HTMLFormElement` and `as HTMLInputElement` type assertions with `instanceof` narrowing to avoid @typescript-eslint/consistent-type-assertions lint failures.

3. ADDED "Do / Don't" section with three concrete anti-patterns:
   - DOM access: `as` assertions vs `instanceof` narrowing
   - Data fetching: subscribe vs async/await
   - Error handling: generic catch vs typed error classes

4. ADDED "Single Document Lookup" section highlighting `.findById()` as the method for fetching by ID — not obvious from just seeing `.find()` examples.

5. EXPANDED FindOptions section with concrete usage examples showing `where`, `sort`, `limit`, `page` together — agents need to see these combined, not just the interface definition.

6. EXPANDED Error Handling section with a table of all error classes, when they're thrown, and their properties. Added `DocumentNotFoundError` and `AccessDeniedError` handling to the full component example.

7. ADDED `void this.loadPosts()` call pattern in constructor (matching codebase convention) instead of bare `this.loadPosts()`.

8. ADDED typed error handling to the full component example's `loadPosts()` and `createPost()` methods — previously only `finally` was shown, no catch with typed errors.

9. ADDED `where` clause to the full component example's `loadPosts()` to demonstrate filtering, which agents wouldn't learn from just seeing the interface.

10. Preserved all passing sections: injection, CRUD, generated types, platform behavior, type generation, TransferState.
-->
