/**
 * Momentum API Service for Angular
 *
 * Provides a unified interface for data operations that works seamlessly
 * in both server-side rendering (SSR) and browser contexts.
 *
 * @example
 * ```typescript
 * import { injectMomentumAPI } from '@momentum-cms/admin';
 *
 * @Component({...})
 * export class PostsComponent {
 *   private readonly api = injectMomentumAPI();
 *
 *   async loadPosts(): Promise<void> {
 *     const result = await this.api.collection<Post>('posts').find({ limit: 10 });
 *     this.posts.set(result.docs);
 *   }
 * }
 * ```
 */

import {
	inject,
	InjectionToken,
	makeStateKey,
	PLATFORM_ID,
	Provider,
	Signal,
	signal,
	StateKey,
	TransferState,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

// ============================================
// Types (mirrored from server-core for browser use)
// ============================================

/**
 * User context for API operations.
 */
export interface UserContext {
	id: string | number;
	email?: string;
	role?: string;
	[key: string]: unknown;
}

/**
 * Context passed to API operations.
 */
export interface MomentumAPIContext {
	user?: UserContext;
	depth?: number;
	showHiddenFields?: boolean;
}

/**
 * Options for find operations.
 */
export interface FindOptions {
	where?: Record<string, unknown>;
	sort?: string;
	limit?: number;
	page?: number;
	depth?: number;
	/** Enable TransferState caching for SSR hydration (default: true) */
	transfer?: boolean;
}

/**
 * Options for findById operations.
 */
export interface FindByIdOptions {
	depth?: number;
	/** Enable TransferState caching for SSR hydration (default: true) */
	transfer?: boolean;
}

/**
 * Result of a find operation with pagination info.
 */
export interface FindResult<T> {
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

/**
 * Result of a delete operation.
 */
export interface DeleteResult {
	id: string;
	deleted: boolean;
}

// ============================================
// Injection Tokens
// ============================================

/**
 * Server-side Momentum API instance.
 * Provided by Express during SSR via provideMomentumAPI().
 * Must be explicitly provided during SSR - not available in browser.
 */
export const MOMENTUM_API = new InjectionToken<MomentumAPIServer>('MOMENTUM_API');

/**
 * User context for the current request.
 * Provided by Express during SSR.
 */
export const MOMENTUM_API_CONTEXT = new InjectionToken<MomentumAPIContext>('MOMENTUM_API_CONTEXT');

/**
 * Creates providers for Momentum API during SSR.
 * Use this in your server.ts when calling angularApp.handle().
 *
 * @example
 * ```typescript
 * import { provideMomentumAPI } from '@momentum-cms/admin';
 *
 * angularApp.handle(req, {
 *   providers: provideMomentumAPI(getMomentumAPI(), { user: req.user }),
 * });
 * ```
 */
export function provideMomentumAPI(
	api: MomentumAPIServer,
	context?: MomentumAPIContext,
): Provider[] {
	return [
		{ provide: MOMENTUM_API, useValue: api },
		{ provide: MOMENTUM_API_CONTEXT, useValue: context ?? {} },
	];
}

// ============================================
// Interfaces
// ============================================

/**
 * Server-side API interface (from @momentum-cms/server-core).
 * This mirrors the MomentumAPI interface for type safety.
 */
export interface MomentumAPIServer {
	collection<T = Record<string, unknown>>(slug: string): CollectionOperationsServer<T>;
	getConfig(): unknown;
	setContext(ctx: MomentumAPIContext): MomentumAPIServer;
	getContext(): MomentumAPIContext;
}

/**
 * Server-side collection operations.
 */
export interface CollectionOperationsServer<T = Record<string, unknown>> {
	find(options?: FindOptions): Promise<FindResult<T>>;
	findById(id: string, options?: { depth?: number }): Promise<T | null>;
	create(data: Partial<T>): Promise<T>;
	update(id: string, data: Partial<T>): Promise<T>;
	delete(id: string): Promise<DeleteResult>;
	count(where?: Record<string, unknown>): Promise<number>;
}

/**
 * Unified client API interface.
 * Works identically on both server (SSR) and browser.
 */
export interface MomentumClientAPI {
	/**
	 * Get operations for a specific collection.
	 */
	collection<T = Record<string, unknown>>(slug: string): MomentumCollectionAPI<T>;
}

/**
 * Collection operations with both Observable and Promise methods.
 */
export interface MomentumCollectionAPI<T = Record<string, unknown>> {
	// Observable methods (Angular-friendly)
	find$(options?: FindOptions): Observable<FindResult<T>>;
	findById$(id: string, options?: FindByIdOptions): Observable<T | null>;
	create$(data: Partial<T>): Observable<T>;
	update$(id: string, data: Partial<T>): Observable<T>;
	delete$(id: string): Observable<DeleteResult>;

	// Promise methods (async/await)
	find(options?: FindOptions): Promise<FindResult<T>>;
	findById(id: string, options?: FindByIdOptions): Promise<T | null>;
	create(data: Partial<T>): Promise<T>;
	update(id: string, data: Partial<T>): Promise<T>;
	delete(id: string): Promise<DeleteResult>;

	// Signal methods (read-only operations)
	findSignal(options?: FindOptions): Signal<FindResult<T> | undefined>;
	findByIdSignal(id: string, options?: FindByIdOptions): Signal<T | null | undefined>;
}

// ============================================
// Type-Safe API Types
// ============================================

/**
 * Typed find options with where clause type.
 */
export interface TypedFindOptions<TWhere> {
	where?: TWhere;
	sort?: string;
	limit?: number;
	page?: number;
	depth?: number;
	/** Enable TransferState caching for SSR hydration */
	transfer?: boolean;
}

/**
 * Typed findById options.
 */
export interface TypedFindByIdOptions {
	depth?: number;
	/** Enable TransferState caching for SSR hydration */
	transfer?: boolean;
}

/**
 * Type-safe collection API with typed where clauses.
 */
export interface TypedCollectionAPI<TDoc, TWhere = Record<string, unknown>> {
	// Observable methods
	find$(options?: TypedFindOptions<TWhere>): Observable<FindResult<TDoc>>;
	findById$(id: string, options?: TypedFindByIdOptions): Observable<TDoc | null>;
	create$(data: Partial<TDoc>): Observable<TDoc>;
	update$(id: string, data: Partial<TDoc>): Observable<TDoc>;
	delete$(id: string): Observable<DeleteResult>;

	// Promise methods
	find(options?: TypedFindOptions<TWhere>): Promise<FindResult<TDoc>>;
	findById(id: string, options?: TypedFindByIdOptions): Promise<TDoc | null>;
	create(data: Partial<TDoc>): Promise<TDoc>;
	update(id: string, data: Partial<TDoc>): Promise<TDoc>;
	delete(id: string): Promise<DeleteResult>;

	// Signal methods (read-only operations)
	findSignal(options?: TypedFindOptions<TWhere>): Signal<FindResult<TDoc> | undefined>;
	findByIdSignal(id: string, options?: TypedFindByIdOptions): Signal<TDoc | null | undefined>;
}

/**
 * Type-safe API interface with direct property access.
 * Maps collection slugs to typed collection APIs.
 *
 * @example
 * ```typescript
 * interface TypedMomentumCollections {
 *   'posts': { doc: Post; where: PostsWhereClause };
 *   'users': { doc: User; where: UsersWhereClause };
 * }
 *
 * const api = injectTypedMomentumAPI<TypedMomentumCollections>();
 * const posts = await api.posts.find(); // posts.docs is Post[]
 * const users = await api.collection('users').find(); // 'users' autocompletes
 * ```
 */
export type TypedMomentumClientAPI<
	TCollections extends { [key: string]: { doc: unknown; where?: unknown } },
> = {
	readonly [K in keyof TCollections]: TypedCollectionAPI<
		TCollections[K]['doc'],
		TCollections[K]['where'] extends undefined ? Record<string, unknown> : TCollections[K]['where']
	>;
} & {
	collection<K extends keyof TCollections & string>(
		slug: K,
	): TypedCollectionAPI<
		TCollections[K]['doc'],
		TCollections[K]['where'] extends undefined ? Record<string, unknown> : TCollections[K]['where']
	>;
};

// ============================================
// TransferState Key Generator
// ============================================

/**
 * Generates a deterministic TransferState key from collection slug and options.
 * Keys are stable across SSR and browser for the same query.
 */
function generateTransferKey<T>(
	collection: string,
	operation: 'find' | 'findById',
	options?: FindOptions | FindByIdOptions,
	id?: string,
): StateKey<T> {
	const parts: string[] = ['mcms', collection, operation];

	if (id) {
		parts.push(id);
	}

	if (options) {
		// Build hash from relevant options (excluding transfer which doesn't affect the query)
		const hashParts: Record<string, unknown> = {};

		if ('where' in options && options.where !== undefined) {
			hashParts['where'] = options.where;
		}
		if ('sort' in options && options.sort !== undefined) {
			hashParts['sort'] = options.sort;
		}
		if ('limit' in options && options.limit !== undefined) {
			hashParts['limit'] = options.limit;
		}
		if ('page' in options && options.page !== undefined) {
			hashParts['page'] = options.page;
		}
		if ('depth' in options && options.depth !== undefined) {
			hashParts['depth'] = options.depth;
		}

		if (Object.keys(hashParts).length > 0) {
			// Sort keys for stable hash
			const sortedKeys = Object.keys(hashParts).sort();
			const sorted: Record<string, unknown> = {};
			for (const key of sortedKeys) {
				sorted[key] = hashParts[key];
			}
			// Use btoa for simple hash, slice for reasonable key length
			parts.push(btoa(JSON.stringify(sorted)).slice(0, 16));
		}
	}

	return makeStateKey<T>(parts.join(':'));
}

// ============================================
// Main Injection Function
// ============================================

/**
 * Inject the Momentum API with automatic platform detection.
 *
 * - On server (SSR): Uses the direct Momentum API (no HTTP overhead)
 * - On browser: Uses HTTP calls to the REST API
 *
 * @returns The platform-appropriate API implementation
 *
 * @example
 * ```typescript
 * @Component({...})
 * export class PostsComponent {
 *   private readonly api = injectMomentumAPI();
 *   readonly posts = signal<Post[]>([]);
 *
 *   constructor() {
 *     // Using observables
 *     this.api.collection<Post>('posts').find$().subscribe(result => {
 *       this.posts.set(result.docs);
 *     });
 *
 *     // Or using promises
 *     this.loadPosts();
 *   }
 *
 *   async loadPosts(): Promise<void> {
 *     const result = await this.api.collection<Post>('posts').find({ limit: 10 });
 *     this.posts.set(result.docs);
 *   }
 * }
 * ```
 */
export function injectMomentumAPI(): MomentumClientAPI {
	const platformId = inject(PLATFORM_ID);
	const transferState = inject(TransferState, { optional: true });

	if (isPlatformServer(platformId)) {
		// Server-side: use direct Momentum API if available
		const serverApi = inject(MOMENTUM_API, { optional: true });
		const userContext = inject(MOMENTUM_API_CONTEXT, { optional: true });

		if (serverApi) {
			// Use direct server API (no HTTP overhead)
			return new ServerMomentumAPI(serverApi, userContext ?? {}, transferState);
		}

		// Fallback to HTTP if server API not initialized yet
		// This can happen during build-time prerendering
		const http = inject(HttpClient);
		return new BrowserMomentumAPI(http, transferState, platformId);
	} else {
		// Browser-side: use HTTP client
		const http = inject(HttpClient);
		return new BrowserMomentumAPI(http, transferState, platformId);
	}
}

/**
 * Inject a type-safe Momentum API with full intellisense for collections.
 *
 * @example
 * ```typescript
 * // First, generate types or define them manually
 * interface TypedMomentumCollections {
 *   'posts': { doc: Post; where: PostsWhereClause };
 *   'users': { doc: User; where: UsersWhereClause };
 * }
 *
 * // Then inject the typed API
 * const api = injectTypedMomentumAPI<TypedMomentumCollections>();
 *
 * // Use with full type safety
 * const posts = await api.posts.find(); // posts.docs is Post[]
 * const users = await api.collection('users').find(); // 'users' autocompletes
 *
 * // Typed where clauses
 * const published = await api.posts.find({
 *   where: { status: 'published' } // type-checked
 * });
 * ```
 */
export function injectTypedMomentumAPI<
	TCollections extends { [key: string]: { doc: unknown; where?: unknown } },
>(): TypedMomentumClientAPI<TCollections> {
	const baseApi = injectMomentumAPI();
	return createTypedProxy<TCollections>(baseApi);
}

/**
 * Creates a typed proxy wrapper around the base API.
 * Enables property access (api.posts) in addition to method access (api.collection('posts')).
 */
function createTypedProxy<
	TCollections extends { [key: string]: { doc: unknown; where?: unknown } },
>(baseApi: MomentumClientAPI): TypedMomentumClientAPI<TCollections> {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Proxy requires empty object cast
	return new Proxy({} as TypedMomentumClientAPI<TCollections>, {
		get(_, prop: string) {
			if (prop === 'collection') {
				// Return the collection method that takes a slug
				return <K extends keyof TCollections & string>(slug: K) => baseApi.collection(slug);
			}
			// Direct property access: api.posts -> api.collection('posts')
			return baseApi.collection(prop);
		},
	});
}

// ============================================
// Server-side Implementation
// ============================================

class ServerMomentumAPI implements MomentumClientAPI {
	private readonly contextualApi: MomentumAPIServer;

	constructor(
		private readonly serverApi: MomentumAPIServer,
		private readonly context: MomentumAPIContext,
		private readonly transferState: TransferState | null,
	) {
		// Apply user context
		this.contextualApi = context.user ? serverApi.setContext(context) : serverApi;
	}

	collection<T = Record<string, unknown>>(slug: string): MomentumCollectionAPI<T> {
		return new ServerCollectionAPI<T>(
			this.contextualApi.collection<T>(slug),
			slug,
			this.transferState,
		);
	}
}

class ServerCollectionAPI<T> implements MomentumCollectionAPI<T> {
	constructor(
		private readonly ops: CollectionOperationsServer<T>,
		private readonly slug: string,
		private readonly transferState: TransferState | null,
	) {}

	// Observable wrappers around promise methods
	find$(options?: FindOptions): Observable<FindResult<T>> {
		return new Observable((subscriber) => {
			this.find(options)
				.then((result) => {
					subscriber.next(result);
					subscriber.complete();
				})
				.catch((err: unknown) => subscriber.error(err));
		});
	}

	findById$(id: string, options?: FindByIdOptions): Observable<T | null> {
		return new Observable((subscriber) => {
			this.findById(id, options)
				.then((result) => {
					subscriber.next(result);
					subscriber.complete();
				})
				.catch((err: unknown) => subscriber.error(err));
		});
	}

	create$(data: Partial<T>): Observable<T> {
		return new Observable((subscriber) => {
			this.ops
				.create(data)
				.then((result) => {
					subscriber.next(result);
					subscriber.complete();
				})
				.catch((err: unknown) => subscriber.error(err));
		});
	}

	update$(id: string, data: Partial<T>): Observable<T> {
		return new Observable((subscriber) => {
			this.ops
				.update(id, data)
				.then((result) => {
					subscriber.next(result);
					subscriber.complete();
				})
				.catch((err: unknown) => subscriber.error(err));
		});
	}

	delete$(id: string): Observable<DeleteResult> {
		return new Observable((subscriber) => {
			this.ops
				.delete(id)
				.then((result) => {
					subscriber.next(result);
					subscriber.complete();
				})
				.catch((err: unknown) => subscriber.error(err));
		});
	}

	// Promise methods with TransferState support (enabled by default)
	async find(options?: FindOptions): Promise<FindResult<T>> {
		const result = await this.ops.find(options);

		// Store in TransferState (enabled by default, opt-out with transfer: false)
		if (options?.transfer !== false && this.transferState) {
			const key = generateTransferKey<FindResult<T>>(this.slug, 'find', options);
			this.transferState.set(key, result);
		}

		return result;
	}

	async findById(id: string, options?: FindByIdOptions): Promise<T | null> {
		const result = await this.ops.findById(id, options);

		// Store in TransferState (enabled by default, opt-out with transfer: false)
		if (options?.transfer !== false && this.transferState) {
			const key = generateTransferKey<T | null>(this.slug, 'findById', options, id);
			this.transferState.set(key, result);
		}

		return result;
	}

	create(data: Partial<T>): Promise<T> {
		return this.ops.create(data);
	}

	update(id: string, data: Partial<T>): Promise<T> {
		return this.ops.update(id, data);
	}

	delete(id: string): Promise<DeleteResult> {
		return this.ops.delete(id);
	}

	// Signal methods (read-only operations)
	findSignal(options?: FindOptions): Signal<FindResult<T> | undefined> {
		const result = signal<FindResult<T> | undefined>(undefined);
		this.find(options).then((data) => result.set(data));
		return result.asReadonly();
	}

	findByIdSignal(id: string, options?: FindByIdOptions): Signal<T | null | undefined> {
		const result = signal<T | null | undefined>(undefined);
		this.findById(id, options).then((data) => result.set(data));
		return result.asReadonly();
	}
}

// ============================================
// Browser-side Implementation
// ============================================

/**
 * API response structure from the REST API.
 */
interface ApiResponse<T> {
	docs?: T[];
	doc?: T;
	totalDocs?: number;
	deleted?: boolean;
	id?: string;
	error?: string;
	errors?: Array<{ field: string; message: string }>;
}

class BrowserMomentumAPI implements MomentumClientAPI {
	private readonly baseUrl = '/api';

	constructor(
		private readonly http: HttpClient,
		private readonly transferState: TransferState | null,
		private readonly platformId: object,
	) {}

	collection<T = Record<string, unknown>>(slug: string): MomentumCollectionAPI<T> {
		return new BrowserCollectionAPI<T>(
			this.http,
			`${this.baseUrl}/${slug}`,
			slug,
			this.transferState,
			this.platformId,
		);
	}
}

/**
 * Browser-side collection API implementation.
 * Type assertions are needed because the HTTP client returns ApiResponse<T>
 * and we need to extract/cast the typed document from the response.
 */

class BrowserCollectionAPI<T> implements MomentumCollectionAPI<T> {
	constructor(
		private readonly http: HttpClient,
		private readonly endpoint: string,
		private readonly slug: string,
		private readonly transferState: TransferState | null,
		private readonly platformId: object,
	) {}

	find$(options?: FindOptions): Observable<FindResult<T>> {
		// Check TransferState cache first (enabled by default, opt-out with transfer: false)
		if (options?.transfer !== false && this.transferState && !isPlatformServer(this.platformId)) {
			const key = generateTransferKey<FindResult<T>>(this.slug, 'find', options);
			const cached = this.transferState.get(key, null);
			if (cached) {
				this.transferState.remove(key);
				return of(cached);
			}
		}

		// Make HTTP call
		const params = this.buildQueryParams(options);
		return this.http.get<ApiResponse<T>>(this.endpoint, { params }).pipe(
			map((response) => {
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ApiResponse.docs is unknown[]
				const docs = (response.docs ?? []) as T[];
				const totalDocs = response.totalDocs ?? docs.length;
				const limit = options?.limit ?? 10;
				const page = options?.page ?? 1;
				const totalPages = Math.ceil(totalDocs / limit) || 1;

				return {
					docs,
					totalDocs,
					totalPages,
					page,
					limit,
					hasNextPage: page < totalPages,
					hasPrevPage: page > 1,
					nextPage: page < totalPages ? page + 1 : undefined,
					prevPage: page > 1 ? page - 1 : undefined,
				};
			}),
		);
	}

	findById$(id: string, options?: FindByIdOptions): Observable<T | null> {
		// Check TransferState cache first (enabled by default, opt-out with transfer: false)
		if (options?.transfer !== false && this.transferState && !isPlatformServer(this.platformId)) {
			const key = generateTransferKey<T | null>(this.slug, 'findById', options, id);
			const cached = this.transferState.get(key, null);
			if (cached !== null) {
				this.transferState.remove(key);
				return of(cached);
			}
		}

		return (
			this.http
				.get<ApiResponse<T>>(`${this.endpoint}/${id}`)
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ApiResponse.doc is unknown
				.pipe(map((response) => (response.doc as T) ?? null))
		);
	}

	create$(data: Partial<T>): Observable<T> {
		return (
			this.http
				.post<ApiResponse<T>>(this.endpoint, data)
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ApiResponse.doc is unknown
				.pipe(map((response) => response.doc as T))
		);
	}

	update$(id: string, data: Partial<T>): Observable<T> {
		return (
			this.http
				.patch<ApiResponse<T>>(`${this.endpoint}/${id}`, data)
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- ApiResponse.doc is unknown
				.pipe(map((response) => response.doc as T))
		);
	}

	delete$(id: string): Observable<DeleteResult> {
		return this.http
			.delete<ApiResponse<T>>(`${this.endpoint}/${id}`)
			.pipe(map((response) => ({ id: response.id ?? id, deleted: response.deleted ?? false })));
	}

	// Promise wrappers
	find(options?: FindOptions): Promise<FindResult<T>> {
		return firstValueFrom(this.find$(options));
	}

	findById(id: string, options?: FindByIdOptions): Promise<T | null> {
		return firstValueFrom(this.findById$(id, options));
	}

	create(data: Partial<T>): Promise<T> {
		return firstValueFrom(this.create$(data));
	}

	update(id: string, data: Partial<T>): Promise<T> {
		return firstValueFrom(this.update$(id, data));
	}

	delete(id: string): Promise<DeleteResult> {
		return firstValueFrom(this.delete$(id));
	}

	// Signal methods (read-only operations)
	findSignal(options?: FindOptions): Signal<FindResult<T> | undefined> {
		const result = signal<FindResult<T> | undefined>(undefined);
		this.find(options).then((data) => result.set(data));
		return result.asReadonly();
	}

	findByIdSignal(id: string, options?: FindByIdOptions): Signal<T | null | undefined> {
		const result = signal<T | null | undefined>(undefined);
		this.findById(id, options).then((data) => result.set(data));
		return result.asReadonly();
	}

	private buildQueryParams(options?: FindOptions): HttpParams {
		let params = new HttpParams();

		if (options?.limit !== undefined) {
			params = params.set('limit', String(options.limit));
		}
		if (options?.page !== undefined) {
			params = params.set('page', String(options.page));
		}
		if (options?.sort) {
			params = params.set('sort', options.sort);
		}
		if (options?.where) {
			// Serialize where clause as JSON
			params = params.set('where', JSON.stringify(options.where));
		}
		if (options?.depth !== undefined) {
			params = params.set('depth', String(options.depth));
		}

		return params;
	}
}
