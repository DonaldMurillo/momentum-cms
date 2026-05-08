/**
 * Shared version route handlers.
 *
 * Framework-agnostic handlers for version-related routes:
 * - GET    /:collection/:id/versions
 * - GET    /:collection/:id/versions/:versionId
 * - POST   /:collection/:id/versions/restore
 * - POST   /:collection/:id/versions/compare
 *
 * Adapters call these and translate the {@link HandlerResult} into their
 * native response format. Centralising validation, error mapping, and
 * response shape here prevents adapter parity drift.
 */

import type { UserContext } from '@momentumcms/core';
import type { HandlerResult } from './handler-types';
import { getMomentumAPI } from './momentum-api';
import type { VersionOperations } from './momentum-api.types';
import { sanitizeErrorMessage } from './shared-server-utils';

/**
 * Resolve the version operations for a collection or return the
 * not-enabled error envelope.
 */
function resolveVersionOps(
	collectionSlug: string,
	user: UserContext | undefined,
):
	| { ok: true; ops: VersionOperations<Record<string, unknown>> }
	| { ok: false; result: HandlerResult } {
	const api = getMomentumAPI();
	const contextApi = user ? api.setContext({ user }) : api;
	const ops = contextApi.collection<Record<string, unknown>>(collectionSlug).versions();
	if (!ops) {
		return {
			ok: false,
			result: {
				status: 400,
				body: {
					error: 'Versioning not enabled',
					message: `Collection "${collectionSlug}" does not have versioning enabled`,
				},
			},
		};
	}
	return { ok: true, ops };
}

function mapAccessOrServerError(error: unknown, errorLabel: string): HandlerResult {
	if (error instanceof Error && error.name === 'AccessDeniedError') {
		return { status: 403, body: { error: 'Access denied' } };
	}
	return {
		status: 500,
		body: {
			error: errorLabel,
			message: sanitizeErrorMessage(error, 'Unknown error'),
		},
	};
}

// ============================================
// GET /:collection/:id/versions
// ============================================

export interface ListVersionsParams {
	collectionSlug: string;
	id: string;
	limit?: number;
	page?: number;
	includeAutosave?: boolean;
	user?: UserContext;
}

export async function handleListVersionsRequest(
	params: ListVersionsParams,
): Promise<HandlerResult> {
	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const result = await check.ops.findVersions(params.id, {
			limit: params.limit,
			page: params.page,
			includeAutosave: params.includeAutosave,
		});
		return { status: 200, body: result };
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to fetch versions');
	}
}

// ============================================
// GET /:collection/:id/versions/:versionId
// ============================================

export interface GetVersionParams {
	collectionSlug: string;
	versionId: string;
	user?: UserContext;
}

export async function handleGetVersionRequest(params: GetVersionParams): Promise<HandlerResult> {
	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const version = await check.ops.findVersionById(params.versionId);
		if (!version) {
			return {
				status: 404,
				body: {
					error: 'Version not found',
					message: `Version "${params.versionId}" not found`,
				},
			};
		}
		return { status: 200, body: version };
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to fetch version');
	}
}

// ============================================
// POST /:collection/:id/versions/restore
// ============================================

export interface RestoreVersionParams {
	collectionSlug: string;
	id: string;
	versionId: unknown;
	publish?: unknown;
	user?: UserContext;
}

export async function handleRestoreVersionRequest(
	params: RestoreVersionParams,
): Promise<HandlerResult> {
	if (typeof params.versionId !== 'string' || params.versionId.length === 0) {
		return {
			status: 400,
			body: {
				error: 'Invalid request',
				message: 'versionId is required in request body',
			},
		};
	}

	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const restored = await check.ops.restore({
			versionId: params.versionId,
			docId: params.id,
			publish: params.publish === true,
		});
		return {
			status: 200,
			body: { doc: restored, message: 'Version restored successfully' },
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes('mismatch')) {
			return {
				status: 400,
				body: {
					error: 'Version parent mismatch',
					message: sanitizeErrorMessage(error, 'Unknown error'),
				},
			};
		}
		return mapAccessOrServerError(error, 'Failed to restore version');
	}
}

// ============================================
// POST /:collection/:id/versions/compare
// ============================================

export interface CompareVersionsParams {
	collectionSlug: string;
	id: string;
	versionId1: unknown;
	versionId2: unknown;
	user?: UserContext;
}

export async function handleCompareVersionsRequest(
	params: CompareVersionsParams,
): Promise<HandlerResult> {
	const { versionId1, versionId2 } = params;
	if (
		typeof versionId1 !== 'string' ||
		typeof versionId2 !== 'string' ||
		!versionId1 ||
		!versionId2
	) {
		return {
			status: 400,
			body: {
				error: 'Missing version IDs',
				message: 'Both versionId1 and versionId2 are required',
			},
		};
	}

	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const differences = await check.ops.compare(versionId1, versionId2, params.id);
		return { status: 200, body: { differences } };
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to compare versions');
	}
}

// ============================================
// POST /:collection/:id/publish
// ============================================

export interface PublishParams {
	collectionSlug: string;
	id: string;
	user?: UserContext;
}

export async function handlePublishRequest(params: PublishParams): Promise<HandlerResult> {
	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const published = await check.ops.publish(params.id);
		return {
			status: 200,
			body: { doc: published, message: 'Document published successfully' },
		};
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to publish document');
	}
}

// ============================================
// POST /:collection/:id/unpublish
// ============================================

export async function handleUnpublishRequest(params: PublishParams): Promise<HandlerResult> {
	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const unpublished = await check.ops.unpublish(params.id);
		return {
			status: 200,
			body: { doc: unpublished, message: 'Document unpublished successfully' },
		};
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to unpublish document');
	}
}

// ============================================
// POST /:collection/:id/draft
// ============================================

export interface SaveDraftParams {
	collectionSlug: string;
	id: string;
	data: Record<string, unknown>;
	user?: UserContext;
}

export async function handleSaveDraftRequest(params: SaveDraftParams): Promise<HandlerResult> {
	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const draft = await check.ops.saveDraft(params.id, params.data);
		return {
			status: 200,
			body: { version: draft, message: 'Draft saved successfully' },
		};
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to save draft');
	}
}

// ============================================
// POST /:collection/:id/schedule-publish
// ============================================

export interface SchedulePublishParams {
	collectionSlug: string;
	id: string;
	publishAt: unknown;
	user?: UserContext;
}

export async function handleSchedulePublishRequest(
	params: SchedulePublishParams,
): Promise<HandlerResult> {
	if (typeof params.publishAt !== 'string' || !params.publishAt) {
		return {
			status: 400,
			body: {
				error: 'Missing publishAt',
				message: 'A publishAt ISO date string is required',
			},
		};
	}

	const parsedDate = new Date(params.publishAt);
	if (Number.isNaN(parsedDate.getTime())) {
		return {
			status: 400,
			body: {
				error: 'Invalid publishAt',
				message: 'publishAt must be a valid ISO date string',
			},
		};
	}
	// Past dates are intentionally allowed — the publish-scheduler will pick
	// them up on its next tick. Validation against past dates lives in the
	// admin schedule dialog, where it's a UX safeguard.

	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		const result = await check.ops.schedulePublish(params.id, params.publishAt);
		return { status: 200, body: result };
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to schedule publish');
	}
}

// ============================================
// POST /:collection/:id/cancel-scheduled-publish
// ============================================

export async function handleCancelScheduledPublishRequest(
	params: PublishParams,
): Promise<HandlerResult> {
	const check = resolveVersionOps(params.collectionSlug, params.user);
	if (!check.ok) return check.result;

	try {
		await check.ops.cancelScheduledPublish(params.id);
		return { status: 200, body: { message: 'Scheduled publish cancelled' } };
	} catch (error) {
		return mapAccessOrServerError(error, 'Failed to cancel scheduled publish');
	}
}
