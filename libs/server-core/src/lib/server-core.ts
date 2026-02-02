import type { CollectionConfig, Field, DatabaseAdapter, MomentumConfig } from '@momentum-cms/core';

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
 * Validates data against collection field definitions.
 */
function validateData(
	data: Record<string, unknown>,
	fields: Field[],
	isUpdate = false,
): ValidationError[] {
	const errors: ValidationError[] = [];

	for (const field of fields) {
		const value = data[field.name];
		const fieldLabel = field.label ?? field.name;

		// Check required fields (only on create, not on update)
		if (field.required && !isUpdate) {
			if (value === undefined || value === null || value === '') {
				errors.push({
					field: field.name,
					message: `${fieldLabel} is required`,
				});
			}
		}

		// Type-specific validation could be added here
	}

	return errors;
}

/**
 * Creates Momentum CMS handlers.
 * Framework-agnostic - can be used with Express, h3, Fastify, etc.
 */
export function createMomentumHandlers(config: MomentumConfig): MomentumHandlers {
	const { collections, db } = config;
	const adapter = db.adapter;

	function getCollection(slug: string): CollectionConfig | undefined {
		return collections.find((c) => c.slug === slug);
	}

	async function handleFind(request: MomentumRequest): Promise<MomentumResponse> {
		const collection = getCollection(request.collectionSlug);
		if (!collection) {
			return { error: 'Collection not found', status: 404 };
		}

		const docs = await adapter.find(request.collectionSlug, request.query ?? {});
		return {
			docs,
			totalDocs: docs.length,
		};
	}

	async function handleFindById(request: MomentumRequest): Promise<MomentumResponse> {
		const collection = getCollection(request.collectionSlug);
		if (!collection) {
			return { error: 'Collection not found', status: 404 };
		}

		if (!request.id) {
			return { error: 'ID is required', status: 400 };
		}

		const doc = await adapter.findById(request.collectionSlug, request.id);
		if (!doc) {
			return { error: 'Document not found', status: 404 };
		}

		return { doc };
	}

	async function handleCreate(request: MomentumRequest): Promise<MomentumResponse> {
		const collection = getCollection(request.collectionSlug);
		if (!collection) {
			return { error: 'Collection not found', status: 404 };
		}

		const data = request.body ?? {};
		const errors = validateData(data, collection.fields, false);

		if (errors.length > 0) {
			return {
				error: 'Validation failed',
				errors,
				status: 400,
			};
		}

		const doc = await adapter.create(request.collectionSlug, data);
		return { doc, status: 201 };
	}

	async function handleUpdate(request: MomentumRequest): Promise<MomentumResponse> {
		const collection = getCollection(request.collectionSlug);
		if (!collection) {
			return { error: 'Collection not found', status: 404 };
		}

		if (!request.id) {
			return { error: 'ID is required', status: 400 };
		}

		// Check if document exists
		const existing = await adapter.findById(request.collectionSlug, request.id);
		if (!existing) {
			return { error: 'Document not found', status: 404 };
		}

		const data = request.body ?? {};
		const errors = validateData(data, collection.fields, true);

		if (errors.length > 0) {
			return {
				error: 'Validation failed',
				errors,
				status: 400,
			};
		}

		const doc = await adapter.update(request.collectionSlug, request.id, data);
		return { doc };
	}

	async function handleDelete(request: MomentumRequest): Promise<MomentumResponse> {
		const collection = getCollection(request.collectionSlug);
		if (!collection) {
			return { error: 'Collection not found', status: 404 };
		}

		if (!request.id) {
			return { error: 'ID is required', status: 400 };
		}

		// Check if document exists
		const existing = await adapter.findById(request.collectionSlug, request.id);
		if (!existing) {
			return { error: 'Document not found', status: 404 };
		}

		await adapter.delete(request.collectionSlug, request.id);
		return { deleted: true, id: request.id };
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
