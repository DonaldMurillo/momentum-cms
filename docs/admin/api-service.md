# API Service

`injectMomentumAPI()` provides a typed client for accessing your collections from Angular components, with automatic SSR hydration via TransferState.

## Basic Usage

```typescript
import { injectMomentumAPI } from '@momentumcms/admin';

@Component({...})
export class PostListComponent {
  private readonly api = injectMomentumAPI();
  readonly posts = this.api.collection('posts').findSignal();
}
```

## Platform Detection

The API automatically uses the optimal transport:

| Platform     | Transport        | Benefit                |
| ------------ | ---------------- | ---------------------- |
| Server (SSR) | Direct API calls | No HTTP overhead       |
| Browser      | HTTP client      | Standard REST requests |

TransferState ensures data fetched during SSR is reused in the browser without duplicate requests.

## Collection API

```typescript
const posts = this.api.collection<Post>('posts');
```

### Observables

```typescript
posts.find$(options?): Observable<FindResult<Post>>
posts.findById$(id, options?): Observable<Post | null>
posts.create$(data): Observable<Post>
posts.update$(id, data): Observable<Post>
posts.delete$(id): Observable<DeleteResult>
posts.forceDelete$(id): Observable<DeleteResult>
posts.restore$(id): Observable<Post>
posts.batchCreate$(items): Observable<Post[]>
posts.batchUpdate$(items): Observable<Post[]>
posts.batchDelete$(ids): Observable<DeleteResult[]>
```

### Promises

```typescript
await posts.find(options?)
await posts.findById(id, options?)
await posts.create(data)
await posts.update(id, data)
await posts.delete(id)
await posts.restore(id)
```

### Signals

```typescript
posts.findSignal(options?): Signal<FindResult<Post> | undefined>
posts.findByIdSignal(id): Signal<Post | null | undefined>
```

## Global API

```typescript
const settings = this.api.global<SiteSettings>('site-settings');

// Same patterns: Observable, Promise, Signal
await settings.get()
await settings.update(data)
settings.getSignal(): Signal<SiteSettings | undefined>
```

## Find Options

```typescript
const result = await posts.find({
	where: { status: 'published' },
	sort: '-createdAt',
	limit: 20,
	page: 1,
	depth: 2,
	transfer: true, // TransferState caching (default: true)
	withDeleted: false, // Include soft-deleted docs
	onlyDeleted: false, // Only soft-deleted docs
});
```

## Find Result

```typescript
interface FindResult<T> {
	docs: T[];
	totalDocs: number;
	totalPages: number;
	page: number;
	limit: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
	nextPage?: number;
	prevPage?: number;
}
```

## TransferState

Data fetched during SSR is cached and reused in the browser:

```typescript
// Fetched on server, reused on client (no duplicate request)
const posts = this.api.collection('posts').findSignal({ limit: 10 });

// Opt out of transfer for data that should always be fresh
const fresh = await this.api.collection('posts').find({ transfer: false });
```

Cache entries are consumed on first browser access (single-use).

## Typed API

For full IntelliSense across all collections:

```typescript
import { injectTypedMomentumAPI } from '@momentumcms/admin';

interface MyCollections {
  posts: { doc: Post; where: PostWhereClause };
  users: { doc: User; where: UserWhereClause };
}

@Component({...})
export class MyComponent {
  private readonly api = injectTypedMomentumAPI<MyCollections>();

  async load(): Promise<void> {
    const posts = await this.api.posts.find(); // Fully typed
  }
}
```

## SSR Provider

In your `server.ts`, provide the server-side API:

```typescript
import { provideMomentumAPI } from '@momentumcms/admin';

// In your Angular SSR bootstrap
providers: [provideMomentumAPI(momentumApi, context)];
```

## Related

- [Admin Overview](overview.md) — Dashboard structure
- [REST API](../server/rest-api.md) — Underlying endpoints
