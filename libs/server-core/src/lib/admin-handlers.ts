/**
 * Shared admin route handlers.
 *
 * Framework-agnostic handlers for non-CRUD admin endpoints. Adapters call
 * these functions and translate the {@link HandlerResult} into their native
 * response format. Keeping the validation, status-code mapping, and response
 * shape here prevents adapter parity drift.
 */

import type { MomentumConfig, ResolvedMomentumConfig, UserContext } from '@momentumcms/core';
import { getCollectionPermissions, type CollectionPermissions } from './collection-access';
import type { HandlerResult } from './import-export-handler';
import { getMomentumAPI, GlobalNotFoundError } from './momentum-api';
import { sanitizeErrorMessage } from './shared-server-utils';

// ============================================
// GET /access
// ============================================

export interface AccessHandlerParams {
	config: MomentumConfig | ResolvedMomentumConfig;
	user?: UserContext;
}

export interface AccessResponseBody {
	collections: CollectionPermissions[];
}

export async function handleAccessRequest(
	params: AccessHandlerParams,
): Promise<HandlerResult<AccessResponseBody>> {
	const collections = await getCollectionPermissions(params.config, params.user);
	return { status: 200, body: { collections } };
}

// ============================================
// GET /:collection/:id/status
// ============================================

export interface StatusHandlerParams {
	collectionSlug: string;
	id: string;
	user?: UserContext;
}

export async function handleStatusRequest(params: StatusHandlerParams): Promise<HandlerResult> {
	const { collectionSlug, id, user } = params;
	const api = getMomentumAPI();
	const contextApi = user ? api.setContext({ user }) : api;

	try {
		const versionOps = contextApi.collection(collectionSlug).versions();
		if (!versionOps) {
			return {
				status: 400,
				body: {
					error: 'Versioning not enabled',
					message: `Collection "${collectionSlug}" does not have versioning enabled`,
				},
			};
		}

		const status = await versionOps.getStatus(id);
		return { status: 200, body: { status } };
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === 'AccessDeniedError') {
				return { status: 403, body: { error: 'Access denied' } };
			}
			if (error.name === 'DocumentNotFoundError') {
				return {
					status: 404,
					body: {
						error: 'Document not found',
						message: sanitizeErrorMessage(error, 'Document not found'),
					},
				};
			}
		}
		return {
			status: 500,
			body: {
				error: 'Failed to get status',
				message: sanitizeErrorMessage(error, 'Unknown error'),
			},
		};
	}
}

// ============================================
// GET /globals/:slug
// ============================================

export interface GetGlobalParams {
	slug: string;
	depth?: number;
	user?: UserContext;
}

export async function handleGetGlobalRequest(params: GetGlobalParams): Promise<HandlerResult> {
	const { slug, user } = params;
	const depth = params.depth ?? 0;
	const api = getMomentumAPI();
	const contextApi = user ? api.setContext({ user }) : api;

	try {
		const doc = await contextApi.global(slug).findOne({ depth });
		return { status: 200, body: { doc } };
	} catch (error) {
		if (error instanceof GlobalNotFoundError) {
			return {
				status: 404,
				body: { error: sanitizeErrorMessage(error, 'Global not found') },
			};
		}
		if (error instanceof Error && error.name === 'AccessDeniedError') {
			return { status: 403, body: { error: 'Access denied' } };
		}
		return {
			status: 500,
			body: { error: sanitizeErrorMessage(error, 'Failed to read global') },
		};
	}
}

// ============================================
// PATCH /globals/:slug
// ============================================

export interface UpdateGlobalParams {
	slug: string;
	data: Record<string, unknown>;
	user?: UserContext;
}

export async function handleUpdateGlobalRequest(
	params: UpdateGlobalParams,
): Promise<HandlerResult> {
	const { slug, data, user } = params;
	const api = getMomentumAPI();
	const contextApi = user ? api.setContext({ user }) : api;

	try {
		const doc = await contextApi.global(slug).update(data);
		return { status: 200, body: { doc } };
	} catch (error) {
		if (error instanceof GlobalNotFoundError) {
			return {
				status: 404,
				body: { error: sanitizeErrorMessage(error, 'Global not found') },
			};
		}
		if (error instanceof Error && error.name === 'AccessDeniedError') {
			return { status: 403, body: { error: 'Access denied' } };
		}
		if (error instanceof Error && error.name === 'ValidationError') {
			return {
				status: 400,
				body: { error: sanitizeErrorMessage(error, 'Validation failed') },
			};
		}
		return {
			status: 500,
			body: { error: sanitizeErrorMessage(error, 'Failed to update global') },
		};
	}
}
