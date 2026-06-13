/**
 * Shared batch operation handler.
 *
 * POST /:collection/batch — performs batchCreate, batchUpdate, or batchDelete
 * with validation, managed-collection guards, and standardised error mapping.
 */

import type { MomentumConfig, ResolvedMomentumConfig, UserContext } from '@momentumcms/core';
import type { HandlerResult } from './handler-types';
import { getMomentumAPI } from './momentum-api';
import { sanitizeErrorMessage } from './shared-server-utils';

/** Maximum number of items in a single batch request. */
export const MAX_BATCH_SIZE = 100;

export interface BatchHandlerParams {
	config: MomentumConfig | ResolvedMomentumConfig;
	collectionSlug: string;
	body: Record<string, unknown>;
	user?: UserContext;
}

function isManagedCollection(
	config: MomentumConfig | ResolvedMomentumConfig,
	slug: string,
): boolean {
	const col = config.collections.find((c) => c.slug === slug);
	return col?.managed === true;
}

function ensureArrayOfRecords(
	value: unknown,
	field: 'items',
): { ok: true; value: Record<string, unknown>[] } | { ok: false; error: string } {
	if (!Array.isArray(value)) {
		return { ok: false, error: `${field} must be an array` };
	}
	if (value.length > MAX_BATCH_SIZE) {
		return {
			ok: false,
			error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
		};
	}
	// Validate each element is a non-null object (not a primitive or array)
	// to prevent silent creation of empty documents from items like 123, "hello", true.
	for (let i = 0; i < value.length; i++) {
		const item = value[i];
		if (typeof item !== 'object' || item === null || Array.isArray(item)) {
			return {
				ok: false,
				error: `${field}[${i}] must be an object, got ${item === null ? 'null' : typeof item}`,
			};
		}
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Array.isArray narrows to unknown[]; validated as object[] above
	return { ok: true, value: value as Record<string, unknown>[] };
}

function ensureArrayOfIds(
	value: unknown,
): { ok: true; value: string[] } | { ok: false; error: string } {
	if (!Array.isArray(value)) {
		return { ok: false, error: 'ids must be an array' };
	}
	if (value.length > MAX_BATCH_SIZE) {
		return {
			ok: false,
			error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
		};
	}
	// Validate each element is a non-empty string — reject numeric/null/undefined/whitespace IDs
	// to prevent silent coercion that would mask input errors as 404s.
	for (let i = 0; i < value.length; i++) {
		const id = value[i];
		if (typeof id !== 'string' || id.trim().length === 0) {
			const hint =
				id === null
					? 'null'
					: id === undefined
						? 'undefined'
						: typeof id !== 'string'
							? typeof id
							: id.length === 0
								? 'empty string'
								: 'whitespace-only string';
			return {
				ok: false,
				error: `ids[${i}] must be a non-empty string, got ${hint}`,
			};
		}
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- every element validated as a non-empty string in the loop above
	return { ok: true, value: value as string[] };
}

/**
 * Adapt a generic array of records to the batchUpdate `{ id, data }` shape.
 * Validates that each item has a non-empty string `id` and an optional `data` object.
 * Returns an error result if any item has an invalid or missing ID.
 */
function toBatchUpdateItems(
	records: Record<string, unknown>[],
):
	| { ok: true; value: { id: string; data: Partial<Record<string, unknown>> }[] }
	| { ok: false; error: string } {
	const result: { id: string; data: Partial<Record<string, unknown>> }[] = [];
	for (let i = 0; i < records.length; i++) {
		const item = records[i];
		const id = item['id'];
		if (typeof id !== 'string' || id.trim().length === 0) {
			const hint =
				id === undefined
					? 'missing'
					: id === null
						? 'null'
						: typeof id !== 'string'
							? typeof id
							: id.length === 0
								? 'empty string'
								: 'whitespace-only string';
			return {
				ok: false,
				error: `items[${i}].id must be a non-empty string (${hint})`,
			};
		}
		const data = item['data'];
		result.push({
			id,
			data: typeof data === 'object' && data !== null ? { ...data } : {},
		});
	}
	return { ok: true, value: result };
}

function mapBatchError(error: unknown): HandlerResult {
	let status = 500;
	if (error instanceof Error) {
		if (error.name === 'ValidationError') status = 400;
		else if (error.name === 'DocumentNotFoundError') status = 404;
		else if (error.name === 'CollectionNotFoundError') status = 404;
		else if (error.name === 'GlobalNotFoundError') status = 404;
		else if (error.name === 'AccessDeniedError') status = 403;
		else if (error.name === 'ReferentialIntegrityError') status = 409;
		// NOTE: No DraftNotVisibleError case — it is only thrown by single-doc
		// findById reads, never by batch create/update/delete operations.
	}
	return {
		status,
		body: { error: sanitizeErrorMessage(error, 'Batch operation failed') },
	};
}

export async function handleBatchRequest(params: BatchHandlerParams): Promise<HandlerResult> {
	const { config, collectionSlug, body, user } = params;

	if (!body || typeof body !== 'object') {
		return { status: 400, body: { error: 'Request body is required and must be an object' } };
	}

	if (isManagedCollection(config, collectionSlug)) {
		return {
			status: 403,
			body: { error: 'Managed collection is read-only' },
		};
	}

	const api = getMomentumAPI();
	const contextApi = user ? api.setContext({ user }) : api;
	const operation = body['operation'];

	try {
		// Resolve collection inside try/catch so CollectionNotFoundError is mapped to 404
		const collection = contextApi.collection<Record<string, unknown>>(collectionSlug);
		if (operation === 'create') {
			const validation = ensureArrayOfRecords(body['items'], 'items');
			if (!validation.ok) return { status: 400, body: { error: validation.error } };
			const docs = await collection.batchCreate(validation.value);
			return {
				status: 201,
				body: { docs, message: `${docs.length} documents created` },
			};
		}
		if (operation === 'update') {
			const validation = ensureArrayOfRecords(body['items'], 'items');
			if (!validation.ok) return { status: 400, body: { error: validation.error } };
			const items = toBatchUpdateItems(validation.value);
			if (!items.ok) return { status: 400, body: { error: items.error } };
			const docs = await collection.batchUpdate(items.value);
			return {
				status: 200,
				body: { docs, message: `${docs.length} documents updated` },
			};
		}
		if (operation === 'delete') {
			const validation = ensureArrayOfIds(body['ids']);
			if (!validation.ok) return { status: 400, body: { error: validation.error } };
			const results = await collection.batchDelete(validation.value);
			return {
				status: 200,
				body: { results, message: `${results.length} documents deleted` },
			};
		}
		return {
			status: 400,
			body: {
				error: 'Invalid operation',
				message: 'operation must be "create", "update", or "delete"',
			},
		};
	} catch (error) {
		return mapBatchError(error);
	}
}
