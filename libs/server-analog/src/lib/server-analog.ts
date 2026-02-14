import {
	createMomentumHandlers,
	type MomentumRequest,
	type MomentumResponse,
} from '@momentum-cms/server-core';
import type { MomentumConfig, ResolvedMomentumConfig } from '@momentum-cms/core';

/**
 * H3 Event interface (simplified for type compatibility).
 */
export interface H3Event {
	method: string;
	path: string;
	context: {
		params?: Record<string, string>;
	};
	node?: {
		req: {
			url?: string;
		};
	};
}

/**
 * Type for readBody function from h3.
 */
export type ReadBodyFn = (event: H3Event) => Promise<Record<string, unknown>>;

/**
 * Type for getQuery function from h3.
 */
export type GetQueryFn = (event: H3Event) => Record<string, string | string[]>;

/**
 * Type for getRouterParams function from h3.
 */
export type GetRouterParamsFn = (event: H3Event) => Record<string, string>;

/**
 * Parses the `where` query parameter.
 * Handles both JSON string format (?where={"slug":{"equals":"home"}})
 * and pre-parsed object format from h3/qs.
 */
function parseWhereParam(raw: unknown): Record<string, unknown> | undefined {
	if (typeof raw === 'string') {
		try {
			// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- JSON.parse returns unknown
			return JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return undefined;
		}
	}
	if (typeof raw === 'object' && raw !== null) {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- qs parsed object
		return raw as Record<string, unknown>;
	}
	return undefined;
}

/**
 * Creates an h3 event handler for Momentum CMS API.
 *
 * Usage in Analog.js:
 * ```typescript
 * // src/server/routes/api/[...momentum].ts
 * import { defineEventHandler, readBody, getQuery, getRouterParams } from 'h3';
 * import { createMomentumHandler } from '@momentum-cms/server-analog';
 * import momentumConfig from '../../../momentum.config';
 *
 * const handler = createMomentumHandler(momentumConfig);
 *
 * export default defineEventHandler(async (event) => {
 *   return handler(event, { readBody, getQuery, getRouterParams });
 * });
 * ```
 */
export function createMomentumHandler(config: MomentumConfig | ResolvedMomentumConfig): (
	event: H3Event,
	utils: {
		readBody: ReadBodyFn;
		getQuery: GetQueryFn;
		getRouterParams: GetRouterParamsFn;
	},
) => Promise<{
	status: number;
	body: MomentumResponse;
}> {
	const handlers = createMomentumHandlers(config);

	return async (event, utils) => {
		const { readBody, getQuery, getRouterParams } = utils;
		const method = event.method.toUpperCase();

		// Parse route: /api/posts or /api/posts/123
		const params = getRouterParams(event);
		const pathSegments = (params['momentum'] ?? '').split('/').filter(Boolean);
		const collectionSlug = pathSegments[0] ?? '';
		const id = pathSegments[1];

		// Parse query params
		const queryParams = getQuery(event);
		const sortParam = queryParams['sort'];
		const query = {
			limit: queryParams['limit'] ? Number(queryParams['limit']) : undefined,
			page: queryParams['page'] ? Number(queryParams['page']) : undefined,
			sort: typeof sortParam === 'string' ? sortParam : undefined,
			depth: queryParams['depth'] ? Number(queryParams['depth']) : undefined,
			where: parseWhereParam(queryParams['where']),
			withDeleted: queryParams['withDeleted'] === 'true',
			onlyDeleted: queryParams['onlyDeleted'] === 'true',
		};

		// Parse body for POST/PATCH/PUT
		let body: Record<string, unknown> = {};
		if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
			try {
				body = await readBody(event);
			} catch {
				body = {};
			}
		}

		// Validate and convert method
		function toMomentumMethod(m: string): MomentumRequest['method'] {
			if (m === 'GET' || m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') {
				return m;
			}
			return 'GET';
		}

		// Create Momentum request
		const request: MomentumRequest = {
			method: toMomentumMethod(method),
			collectionSlug,
			id,
			body,
			query,
		};

		// Route the request
		const response = await handlers.routeRequest(request);

		return {
			status: response.status ?? 200,
			body: response,
		};
	};
}

/**
 * Simplified handler that returns the response directly (for use with defineEventHandler).
 * This version handles method extraction and body parsing internally.
 */
export function createSimpleMomentumHandler(config: MomentumConfig | ResolvedMomentumConfig): (
	event: H3Event,
	utils: {
		readBody: ReadBodyFn;
		getQuery: GetQueryFn;
		getRouterParams: GetRouterParamsFn;
		setResponseStatus: (event: H3Event, status: number) => void;
	},
) => Promise<MomentumResponse> {
	const baseHandler = createMomentumHandler(config);

	return async (event, utils) => {
		const { setResponseStatus, ...rest } = utils;
		const result = await baseHandler(event, rest);
		setResponseStatus(event, result.status);
		return result.body;
	};
}
