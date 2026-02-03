import type { DatabaseAdapter, MomentumConfig } from '@momentum-cms/core';
import {
	initializeMomentumAPI,
	getMomentumAPI,
	isMomentumAPIInitialized,
	CollectionNotFoundError,
	DocumentNotFoundError,
	AccessDeniedError,
	ValidationError as MomentumValidationError,
} from './momentum-api';
import type { MomentumAPI, MomentumAPIContext } from './momentum-api.types';

// Re-export types for convenience
export type { DatabaseAdapter, MomentumConfig, ResolvedMomentumConfig } from '@momentum-cms/core';

/**
 * Query options for database operations.
 */
export interface QueryOptions {
	limit?: number;
	page?: number;
	sort?: string;
	where?: Record<string, unknown>;
	[key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

/**
 * Momentum request object - framework-agnostic.
 */
export interface MomentumRequest {
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
	collectionSlug: string;
	id?: string;
	body?: Record<string, unknown>;
	query?: QueryOptions;
	/** User context for access control */
	user?: MomentumAPIContext['user'];
}

/**
 * Validation error structure.
 */
export interface ValidationError {
	field: string;
	message: string;
}

/**
 * Momentum response object - framework-agnostic.
 */
export interface MomentumResponse {
	status?: number;
	docs?: Record<string, unknown>[];
	doc?: Record<string, unknown>;
	totalDocs?: number;
	deleted?: boolean;
	id?: string;
	error?: string;
	errors?: ValidationError[];
}

/**
 * Momentum handlers interface.
 */
export interface MomentumHandlers {
	handleFind(request: MomentumRequest): Promise<MomentumResponse>;
	handleFindById(request: MomentumRequest): Promise<MomentumResponse>;
	handleCreate(request: MomentumRequest): Promise<MomentumResponse>;
	handleUpdate(request: MomentumRequest): Promise<MomentumResponse>;
	handleDelete(request: MomentumRequest): Promise<MomentumResponse>;
	routeRequest(request: MomentumRequest): Promise<MomentumResponse>;
}

/**
 * Creates Momentum CMS handlers.
 * Framework-agnostic - can be used with Express, h3, Fastify, etc.
 *
 * Now delegates to the MomentumAPI singleton for consistent behavior
 * between HTTP requests and direct API calls.
 */
export function createMomentumHandlers(config: MomentumConfig): MomentumHandlers {
	// Initialize the Momentum API if not already done
	if (!isMomentumAPIInitialized()) {
		initializeMomentumAPI(config);
	}

	/**
	 * Get the API instance with request context applied.
	 */
	function getContextualAPI(request: MomentumRequest): MomentumAPI {
		const api = getMomentumAPI();
		if (request.user) {
			return api.setContext({ user: request.user });
		}
		return api;
	}

	async function handleFind(request: MomentumRequest): Promise<MomentumResponse> {
		try {
			const api = getContextualAPI(request);
			const result = await api.collection<Record<string, unknown>>(request.collectionSlug).find({
				limit: request.query?.limit,
				page: request.query?.page,
				sort: request.query?.sort,
				where: request.query?.where,
			});

			return {
				docs: result.docs,
				totalDocs: result.totalDocs,
			};
		} catch (error) {
			return handleError(error);
		}
	}

	async function handleFindById(request: MomentumRequest): Promise<MomentumResponse> {
		if (!request.id) {
			return { error: 'ID is required', status: 400 };
		}

		try {
			const api = getContextualAPI(request);
			const doc = await api
				.collection<Record<string, unknown>>(request.collectionSlug)
				.findById(request.id);

			if (!doc) {
				return { error: 'Document not found', status: 404 };
			}

			return { doc };
		} catch (error) {
			return handleError(error);
		}
	}

	async function handleCreate(request: MomentumRequest): Promise<MomentumResponse> {
		try {
			const api = getContextualAPI(request);
			const doc = await api
				.collection<Record<string, unknown>>(request.collectionSlug)
				.create(request.body ?? {});

			return { doc, status: 201 };
		} catch (error) {
			return handleError(error);
		}
	}

	async function handleUpdate(request: MomentumRequest): Promise<MomentumResponse> {
		if (!request.id) {
			return { error: 'ID is required', status: 400 };
		}

		try {
			const api = getContextualAPI(request);
			const doc = await api
				.collection<Record<string, unknown>>(request.collectionSlug)
				.update(request.id, request.body ?? {});

			return { doc };
		} catch (error) {
			return handleError(error);
		}
	}

	async function handleDelete(request: MomentumRequest): Promise<MomentumResponse> {
		if (!request.id) {
			return { error: 'ID is required', status: 400 };
		}

		try {
			const api = getContextualAPI(request);
			const result = await api.collection(request.collectionSlug).delete(request.id);

			return { deleted: result.deleted, id: result.id };
		} catch (error) {
			return handleError(error);
		}
	}

	async function routeRequest(request: MomentumRequest): Promise<MomentumResponse> {
		switch (request.method) {
			case 'GET':
				if (request.id) {
					return handleFindById(request);
				}
				return handleFind(request);
			case 'POST':
				return handleCreate(request);
			case 'PATCH':
			case 'PUT':
				return handleUpdate(request);
			case 'DELETE':
				return handleDelete(request);
			default:
				return { error: 'Method not allowed', status: 405 };
		}
	}

	return {
		handleFind,
		handleFindById,
		handleCreate,
		handleUpdate,
		handleDelete,
		routeRequest,
	};
}

/**
 * Convert API errors to MomentumResponse format.
 */
function handleError(error: unknown): MomentumResponse {
	if (error instanceof CollectionNotFoundError) {
		return { error: error.message, status: 404 };
	}
	if (error instanceof DocumentNotFoundError) {
		return { error: error.message, status: 404 };
	}
	if (error instanceof AccessDeniedError) {
		return { error: error.message, status: 403 };
	}
	if (error instanceof MomentumValidationError) {
		return {
			error: 'Validation failed',
			errors: error.errors,
			status: 400,
		};
	}
	if (error instanceof Error) {
		return { error: error.message, status: 500 };
	}
	return { error: 'Unknown error', status: 500 };
}

/**
 * In-memory database adapter for development/testing.
 */
export function createInMemoryAdapter(): DatabaseAdapter {
	const store: Map<string, Map<string, Record<string, unknown>>> = new Map();
	let idCounter = 1;

	function getStore(collection: string): Map<string, Record<string, unknown>> {
		if (!store.has(collection)) {
			store.set(collection, new Map());
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return store.get(collection)!;
	}

	return {
		async find(
			collection: string,
			_query: Record<string, unknown>,
		): Promise<Record<string, unknown>[]> {
			const collectionStore = getStore(collection);
			return Array.from(collectionStore.values());
		},

		async findById(collection: string, id: string): Promise<Record<string, unknown> | null> {
			const collectionStore = getStore(collection);
			return collectionStore.get(id) ?? null;
		},

		async create(
			collection: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			const collectionStore = getStore(collection);
			const id = String(idCounter++);
			const doc = {
				...data,
				id,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			collectionStore.set(id, doc);
			return doc;
		},

		async update(
			collection: string,
			id: string,
			data: Record<string, unknown>,
		): Promise<Record<string, unknown>> {
			const collectionStore = getStore(collection);
			const existing = collectionStore.get(id);
			if (!existing) {
				throw new Error('Document not found');
			}
			const doc = {
				...existing,
				...data,
				id,
				updatedAt: new Date().toISOString(),
			};
			collectionStore.set(id, doc);
			return doc;
		},

		async delete(collection: string, id: string): Promise<boolean> {
			const collectionStore = getStore(collection);
			return collectionStore.delete(id);
		},
	};
}
