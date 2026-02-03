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

import { inject, InjectionToken, PLATFORM_ID, Provider, Signal, signal } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
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
	locale?: string;
	fallbackLocale?: string;
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
	findById$(id: string): Observable<T | null>;
	create$(data: Partial<T>): Observable<T>;
	update$(id: string, data: Partial<T>): Observable<T>;
	delete$(id: string): Observable<DeleteResult>;

	// Promise methods (async/await)
	find(options?: FindOptions): Promise<FindResult<T>>;
	findById(id: string): Promise<T | null>;
	create(data: Partial<T>): Promise<T>;
	update(id: string, data: Partial<T>): Promise<T>;
	delete(id: string): Promise<DeleteResult>;

	// Signal methods (read-only operations)
	findSignal(options?: FindOptions): Signal<FindResult<T> | undefined>;
	findByIdSignal(id: string): Signal<T | null | undefined>;
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
}

/**
 * Type-safe collection API with typed where clauses.
 */
export interface TypedCollectionAPI<TDoc, TWhere = Record<string, unknown>> {
	// Observable methods
	find$(options?: TypedFindOptions<TWhere>): Observable<FindResult<TDoc>>;
	findById$(id: string): Observable<TDoc | null>;
	create$(data: Partial<TDoc>): Observable<TDoc>;
	update$(id: string, data: Partial<TDoc>): Observable<TDoc>;
	delete$(id: string): Observable<DeleteResult>;

	// Promise methods
	find(options?: TypedFindOptions<TWhere>): Promise<FindResult<TDoc>>;
	findById(id: string): Promise<TDoc | null>;
	create(data: Partial<TDoc>): Promise<TDoc>;
	update(id: string, data: Partial<TDoc>): Promise<TDoc>;
	delete(id: string): Promise<DeleteResult>;

	// Signal methods (read-only operations)
	findSignal(options?: TypedFindOptions<TWhere>): Signal<FindResult<TDoc> | undefined>;
	findByIdSignal(id: string): Signal<TDoc | null | undefined>;
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

	if (isPlatformServer(platformId)) {
		// Server-side: use direct Momentum API if available
		const serverApi = inject(MOMENTUM_API, { optional: true });
		const userContext = inject(MOMENTUM_API_CONTEXT, { optional: true });

		if (serverApi) {
			// Use direct server API (no HTTP overhead)
			return new ServerMomentumAPI(serverApi, userContext ?? {});
		}

		// Fallback to HTTP if server API not initialized yet
		// This can happen during build-time prerendering
		const http = inject(HttpClient);
		return new BrowserMomentumAPI(http);
	} else {
		// Browser-side: use HTTP client
		const http = inject(HttpClient);
		return new BrowserMomentumAPI(http);
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
	) {
		// Apply user context
		this.contextualApi = context.user ? serverApi.setContext(context) : serverApi;
	}

	collection<T = Record<string, unknown>>(slug: string): MomentumCollectionAPI<T> {
		return new ServerCollectionAPI<T>(this.contextualApi.collection<T>(slug));
	}
}

class ServerCollectionAPI<T> implements MomentumCollectionAPI<T> {
	constructor(private readonly ops: CollectionOperationsServer<T>) {}

	// Observable wrappers around promise methods
	find$(options?: FindOptions): Observable<FindResult<T>> {
		return new Observable((subscriber) => {
			this.ops
				.find(options)
				.then((result) => {
					subscriber.next(result);
					subscriber.complete();
				})
				.catch((err: unknown) => subscriber.error(err));
		});
	}

	findById$(id: string): Observable<T | null> {
		return new Observable((subscriber) => {
			this.ops
				.findById(id)
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

	// Promise methods (direct delegation)
	find(options?: FindOptions): Promise<FindResult<T>> {
		return this.ops.find(options);
	}

	findById(id: string): Promise<T | null> {
		return this.ops.findById(id);
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

	findByIdSignal(id: string): Signal<T | null | undefined> {
		const result = signal<T | null | undefined>(undefined);
		this.findById(id).then((data) => result.set(data));
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

	constructor(private readonly http: HttpClient) {}

	collection<T = Record<string, unknown>>(slug: string): MomentumCollectionAPI<T> {
		return new BrowserCollectionAPI<T>(this.http, `${this.baseUrl}/${slug}`);
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
	) {}

	find$(options?: FindOptions): Observable<FindResult<T>> {
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

	findById$(id: string): Observable<T | null> {
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

	findById(id: string): Promise<T | null> {
		return firstValueFrom(this.findById$(id));
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

	findByIdSignal(id: string): Signal<T | null | undefined> {
		const result = signal<T | null | undefined>(undefined);
		this.findById(id).then((data) => result.set(data));
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
