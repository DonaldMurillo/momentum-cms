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
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Array.isArray narrows to unknown[]; consumers validate item shape
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
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Array.isArray narrows to unknown[]; consumers validate item shape
	return { ok: true, value: value as string[] };
}

/**
 * Adapt a generic array of records to the batchUpdate `{ id, data }` shape.
 * Mirrors existing adapter behaviour: caller is expected to send the correct
 * shape; the API layer surfaces shape errors as ValidationError.
 */
function toBatchUpdateItems(
	records: Record<string, unknown>[],
): { id: string; data: Partial<Record<string, unknown>> }[] {
	const result: { id: string; data: Partial<Record<string, unknown>> }[] = [];
	for (const item of records) {
		const id = item['id'];
		const data = item['data'];
		result.push({
			id: typeof id === 'string' ? id : String(id ?? ''),
			data: typeof data === 'object' && data !== null ? { ...data } : {},
		});
	}
	return result;
}

function mapBatchError(error: unknown): HandlerResult {
	let status = 500;
	if (error instanceof Error) {
		if (error.name === 'ValidationError') status = 400;
		else if (error.name === 'DocumentNotFoundError') status = 404;
		else if (error.name === 'AccessDeniedError') status = 403;
	}
	return {
		status,
		body: { error: sanitizeErrorMessage(error, 'Batch operation failed') },
	};
}

export async function handleBatchRequest(params: BatchHandlerParams): Promise<HandlerResult> {
	const { config, collectionSlug, body, user } = params;

	if (isManagedCollection(config, collectionSlug)) {
		return {
			status: 403,
			body: { error: 'Managed collection is read-only' },
		};
	}

	const api = getMomentumAPI();
	const contextApi = user ? api.setContext({ user }) : api;
	const collection = contextApi.collection<Record<string, unknown>>(collectionSlug);
	const operation = body['operation'];

	try {
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
			const docs = await collection.batchUpdate(toBatchUpdateItems(validation.value));
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
