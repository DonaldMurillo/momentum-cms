/**
 * Shared workflow route handlers.
 *
 * Framework-agnostic handlers for workflow-related routes:
 * - POST /:collection/:id/transition
 * - GET  /:collection/:id/workflow-history
 *
 * Adapters call these and translate the {@link HandlerResult} into their
 * native response format. The handler owns:
 *   - Secure-by-default gate: when neither `access.update` nor
 *     `workflow.access.transition` is configured, transitions are denied
 *     outright (overrideAccess still passes for internal callers).
 *   - Access checks (collection update + workflow.access.transition, AND-composed)
 *   - Transition validation (canTransition)
 *   - Hook firing (beforeTransition / afterTransition)
 *   - Triggering publish/unpublish for stages with publishesOnEnter/unpublishesOnEnter
 *
 * Concurrency is delegated to `adapter.transitionWorkflowStage` which performs
 * the SELECT-FOR-UPDATE + CAS validation + history insert in a single tx.
 */

import type {
	CollectionConfig,
	RequestContext,
	UserContext,
	WORKFLOW_ERROR_CODES as ErrorCodesType,
	WorkflowTransitionHookArgs,
} from '@momentumcms/core';
import {
	WORKFLOW_ERROR_CODES,
	canTransition,
	findStage,
	hasWorkflow,
	requiresPublish,
	requiresUnpublish,
} from '@momentumcms/core';
import { createLogger } from '@momentumcms/logger';
import type { HandlerResult } from './handler-types';
import type { MomentumAPI } from './momentum-api.types';
import { getMomentumAPI } from './momentum-api';
import { sanitizeErrorMessage } from './shared-server-utils';

const log = createLogger('Workflow');

/**
 * Maximum length for a single transition comment. Prevents an authenticated
 * editor from inflating the `*_workflow_history` table with multi-megabyte
 * rows on each draft↔in-review toggle.
 */
const MAX_COMMENT_LENGTH = 2000;

/**
 * Build a RequestContext mirroring `buildRequestContext()` in momentum-api.ts so
 * workflow access functions and hooks receive the same `{ user, api }` shape as
 * every other access/hook callsite. Without this, `req.api.collection(...)`
 * crashes with `TypeError: Cannot read properties of undefined`.
 */
function buildWorkflowReqContext(
	contextApi: MomentumAPI,
	user: UserContext | undefined,
): RequestContext {
	return {
		user,
		api: {
			collection: <U>(slug: string) => contextApi.collection<U>(slug),
		},
	};
}

type WorkflowErrorCode = (typeof ErrorCodesType)[keyof typeof ErrorCodesType];

/** Resolve config + collection + adapter, or return a typed error envelope. */
function resolveWorkflow(collectionSlug: string):
	| {
			ok: true;
			collection: CollectionConfig & { workflow: NonNullable<CollectionConfig['workflow']> };
	  }
	| { ok: false; result: HandlerResult } {
	const api = getMomentumAPI();
	const config = api.getConfig();
	const collection = config.collections.find((c) => c.slug === collectionSlug);
	if (!collection) {
		return {
			ok: false,
			result: {
				status: 404,
				body: { error: 'Collection not found', code: 'COLLECTION_NOT_FOUND' },
			},
		};
	}
	if (!hasWorkflow(collection)) {
		return {
			ok: false,
			result: {
				status: 400,
				body: {
					error: 'Workflow not configured',
					code: WORKFLOW_ERROR_CODES.WorkflowNotConfigured,
					message: `Collection "${collectionSlug}" does not have a workflow configured`,
				},
			},
		};
	}
	return { ok: true, collection };
}

function workflowError(
	status: number,
	code: WorkflowErrorCode,
	message: string,
	extra: Record<string, unknown> = {},
): HandlerResult {
	return {
		status,
		body: { error: message, code, ...extra },
	};
}

// ============================================
// POST /:collection/:id/transition
// ============================================

export interface TransitionParams {
	collectionSlug: string;
	id: string;
	body: {
		toStage?: unknown;
		comment?: unknown;
		expectedStage?: unknown;
		expectedUpdatedAt?: unknown;
	};
	user?: UserContext;
}

export async function handleTransitionRequest(params: TransitionParams): Promise<HandlerResult> {
	const resolved = resolveWorkflow(params.collectionSlug);
	if (!resolved.ok) return resolved.result;
	const { collection } = resolved;
	const workflow = collection.workflow;

	const toStage = params.body.toStage;
	if (typeof toStage !== 'string' || toStage.length === 0) {
		return workflowError(400, WORKFLOW_ERROR_CODES.UnknownStage, 'toStage is required');
	}
	if (!findStage(workflow, toStage)) {
		return workflowError(
			400,
			WORKFLOW_ERROR_CODES.UnknownStage,
			`Stage "${toStage}" is not defined for collection "${params.collectionSlug}"`,
		);
	}

	const commentRaw = typeof params.body.comment === 'string' ? params.body.comment : undefined;
	if (commentRaw !== undefined && commentRaw.length > MAX_COMMENT_LENGTH) {
		return {
			status: 400,
			body: {
				error: 'Comment exceeds maximum length',
				message: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`,
				maxLength: MAX_COMMENT_LENGTH,
			},
		};
	}
	const comment = commentRaw;
	const expectedStage =
		typeof params.body.expectedStage === 'string' ? params.body.expectedStage : undefined;
	const expectedUpdatedAt =
		typeof params.body.expectedUpdatedAt === 'string' ? params.body.expectedUpdatedAt : undefined;

	const api = getMomentumAPI();
	const config = api.getConfig();
	const adapter = config.db.adapter;
	if (!adapter.transitionWorkflowStage) {
		return {
			status: 500,
			body: { error: 'Adapter does not implement workflow operations' },
		};
	}

	const contextApi = params.user ? api.setContext({ user: params.user }) : api;
	const ops = contextApi.collection<Record<string, unknown>>(params.collectionSlug);

	let doc: Record<string, unknown> | null;
	try {
		doc = await ops.findById(params.id);
	} catch (error) {
		if (error instanceof Error && error.name === 'AccessDeniedError') {
			return { status: 403, body: { error: 'Access denied' } };
		}
		if (error instanceof Error && error.name === 'DocumentNotFoundError') {
			return { status: 404, body: { error: 'Document not found' } };
		}
		return {
			status: 500,
			body: {
				error: 'Failed to read document',
				message: sanitizeErrorMessage(error, 'Unknown error'),
			},
		};
	}
	if (!doc) {
		return { status: 404, body: { error: 'Document not found' } };
	}

	const stageRaw = doc['workflowStage'];
	const fromStage = typeof stageRaw === 'string' ? stageRaw : workflow.initialStage;

	// Accept the request if the declared transition graph supports it from
	// EITHER the doc's current stage OR the caller's claimed `expectedStage`.
	// Concurrent-transition race: another tx may have moved the doc between
	// our findById and the adapter call; without honoring the caller's claim
	// we'd return 400 InvalidTransition where the adapter's CAS would have
	// returned the canonical 409 ConflictStaleStage with the new
	// currentStage. Only reject as invalid when BOTH stages fail the graph
	// check, since then no plausible reality supports the request.
	const fromDocOk = canTransition(workflow, fromStage, toStage);
	const fromClaimOk =
		expectedStage !== undefined && canTransition(workflow, expectedStage, toStage);
	if (!fromDocOk && !fromClaimOk) {
		// Intentionally omit `from` from the response body: the InvalidTransition
		// error must not reveal the document's current stage. A caller with the
		// per-stage readStage gate denied for the current stage would otherwise
		// fingerprint stage state via a no-op transition POST. The error message
		// is also kept generic for the same reason.
		return workflowError(
			400,
			WORKFLOW_ERROR_CODES.InvalidTransition,
			`Transition to "${toStage}" is not allowed from the document's current stage`,
			{ to: toStage },
		);
	}

	const reqContext = buildWorkflowReqContext(contextApi, params.user);
	const overrideAccess = contextApi.getContext().overrideAccess === true;

	// Secure-by-default: a workflow with no access.update and no
	// workflow.access.transition would otherwise inherit the "no access
	// function = allow all" default, letting anonymous callers transition
	// stages — including ones with publishesOnEnter that bypass the publish
	// gate. Require at least one explicit guard before processing.
	const updateAccessFn = collection.access?.update;
	const transitionAccessFn = workflow.access?.transition;
	if (!overrideAccess && !updateAccessFn && !transitionAccessFn) {
		return {
			status: 403,
			body: {
				error: 'Access denied',
				message:
					'Workflow transitions require collection access.update or workflow.access.transition to be configured.',
			},
		};
	}

	// AND-compose with collection update access. Without this, a collection
	// that omits `workflow.access.transition` would let any reader change
	// stages — including stages that auto-publish.
	if (!overrideAccess && updateAccessFn) {
		const allowed = await updateAccessFn({
			req: reqContext,
			id: params.id,
			data: { workflowStage: toStage },
		});
		if (!allowed) {
			return { status: 403, body: { error: 'Access denied' } };
		}
	}

	if (!overrideAccess && transitionAccessFn) {
		const allowed = await transitionAccessFn({
			req: reqContext,
			id: params.id,
			from: fromStage,
			to: toStage,
			doc,
		});
		if (!allowed) {
			return { status: 403, body: { error: 'Access denied' } };
		}
	}

	const hookArgs: WorkflowTransitionHookArgs = {
		req: reqContext,
		from: fromStage,
		to: toStage,
		comment,
		doc,
	};

	for (const hook of workflow.hooks?.beforeTransition ?? []) {
		try {
			await hook(hookArgs);
		} catch (error) {
			return {
				status: 400,
				body: {
					error: 'Transition aborted by beforeTransition hook',
					message: sanitizeErrorMessage(error, 'Hook rejected transition'),
				},
			};
		}
	}

	// Pre-check publish access for transitions that will fire publish/unpublish.
	// Without this, a transition into a `publishesOnEnter` stage by a caller
	// who lacks `publishVersions` access commits the stage in tx A, fails
	// publish() in step 2, then auto-reverts in tx B — leaving `→ approved`
	// and `[auto-revert]` rows in the audit log even though the right
	// answer was "you don't have permission." We fail closed BEFORE writing.
	// `checkPublishAccess` gates both publish and unpublish on the same
	// `publishVersions` access function, so the two predicates collapse.
	const willChangePublishState =
		requiresPublish(workflow, toStage) || requiresUnpublish(workflow, toStage);
	if (!overrideAccess && willChangePublishState) {
		const versionOpsEarly = ops.versions();
		if (versionOpsEarly) {
			try {
				await versionOpsEarly.checkPublishAccess();
			} catch (error) {
				if (error instanceof Error && error.name === 'AccessDeniedError') {
					return { status: 403, body: { error: 'Access denied' } };
				}
				return {
					status: 500,
					body: {
						error: 'Publish access check failed',
						message: sanitizeErrorMessage(error, 'Unknown error'),
					},
				};
			}
		}
	}

	let result;
	try {
		result = await adapter.transitionWorkflowStage(params.collectionSlug, params.id, {
			from: fromStage,
			to: toStage,
			expectedStage,
			expectedUpdatedAt,
			userId: params.user?.id !== undefined ? String(params.user.id) : undefined,
			comment,
		});
	} catch (error) {
		return {
			status: 500,
			body: {
				error: 'Failed to transition workflow stage',
				message: sanitizeErrorMessage(error, 'Unknown error'),
			},
		};
	}

	if (!result) {
		return { status: 404, body: { error: 'Document not found' } };
	}

	if (result.conflict) {
		// Mirror the InvalidTransition stage-leak defense above: the 409 retry
		// envelope normally returns the post-conflict `currentStage` for client
		// retry UX, but `currentStage` is doc-derived state read AFTER a
		// concurrent transition committed. If the collection configures a
		// per-stage read gate (`readStage`) and it denies this caller for that
		// stage, returning it would let a CAS race fingerprint a stage the
		// caller is forbidden from reading (the `findById` readStage→404 gate
		// only covers the stage at read time, not the post-race stage). Drop
		// the doc-derived fields in that case; the 409 code alone still tells
		// the caller to refresh.
		let exposeCurrent = true;
		const readStageFn =
			!overrideAccess && typeof result.currentStage === 'string'
				? workflow.access?.readStage?.[result.currentStage]
				: undefined;
		if (readStageFn) {
			const allowed = await readStageFn({ req: reqContext, id: params.id });
			if (!allowed) exposeCurrent = false;
		}
		return workflowError(
			409,
			WORKFLOW_ERROR_CODES.ConflictStaleStage,
			'Workflow stage was modified by another request — refresh and retry',
			exposeCurrent
				? {
						currentStage: result.currentStage,
						currentUpdatedAt: result.currentUpdatedAt,
					}
				: {},
		);
	}

	let published = false;
	let unpublished = false;
	const versionOps = ops.versions();
	if (versionOps) {
		try {
			if (requiresPublish(workflow, toStage)) {
				await versionOps.publish(params.id);
				published = true;
			} else if (requiresUnpublish(workflow, toStage)) {
				await versionOps.unpublish(params.id);
				unpublished = true;
			}
		} catch (error) {
			// The stage transition has already committed but the publish flow
			// failed — without compensation the doc would be left in a
			// split-brain state (e.g., stage='approved' but _status='draft'),
			// defeating the publish gate. Best-effort revert using the new
			// updatedAt as the CAS token so we don't clobber a third-party
			// transition that landed in between.
			let reverted = false;
			let revertError: unknown = null;
			// Log the underlying publish failure here BEFORE the revert call.
			// The history row's comment is intentionally generic — the
			// sanitized error message can still carry operational detail
			// (constraint names, gateway hostnames, plugin paths) that should
			// not flow into the user-visible audit trail.
			log.error(
				`Publish/unpublish failed for ${params.collectionSlug}/${params.id} (${result.fromStage} → ${result.toStage}); attempting auto-revert: ${sanitizeErrorMessage(error, 'unknown')}`,
			);
			try {
				const revert = await adapter.transitionWorkflowStage(params.collectionSlug, params.id, {
					from: result.toStage,
					to: result.fromStage,
					expectedStage: result.toStage,
					expectedUpdatedAt: result.workflowUpdatedAt,
					userId: params.user?.id !== undefined ? String(params.user.id) : undefined,
					comment: '[auto-revert] publish/unpublish failed',
				});
				reverted = !!revert && !revert.conflict;
				if (revert && revert.conflict) {
					log.error(
						`Auto-revert conflict for ${params.collectionSlug}/${params.id} — manual reconciliation required (current stage: ${revert.currentStage})`,
					);
				}
			} catch (revertErr) {
				revertError = revertErr;
				log.error(
					`Auto-revert failed for ${params.collectionSlug}/${params.id} after publish failure: ${sanitizeErrorMessage(revertErr, 'unknown')}`,
				);
			}
			return {
				status: 500,
				body: {
					error: reverted
						? 'Publish/unpublish failed — workflow stage reverted'
						: 'Stage transitioned but publish/unpublish failed; manual reconciliation may be required',
					message: sanitizeErrorMessage(error, 'Unknown error'),
					reverted,
					revertError: revertError ? sanitizeErrorMessage(revertError, 'unknown') : undefined,
					transition: reverted ? undefined : result,
				},
			};
		}
	}

	for (const hook of workflow.hooks?.afterTransition ?? []) {
		try {
			await hook(hookArgs);
		} catch (error) {
			// Stage change is already committed; hook failures are side-effect
			// only (webhooks, notifications). Don't roll back the user-visible
			// action, but log so operators can spot outages.
			log.error(
				`afterTransition hook failed for ${params.collectionSlug}/${params.id} (${fromStage} → ${toStage}): ${sanitizeErrorMessage(error, 'unknown')}`,
			);
		}
	}

	return {
		status: 200,
		body: {
			id: params.id,
			fromStage: result.fromStage,
			toStage: result.toStage,
			workflowUpdatedAt: result.workflowUpdatedAt,
			historyId: result.history.id,
			published,
			unpublished,
		},
	};
}

// ============================================
// GET /:collection/:id/workflow-history
// ============================================

export interface ListWorkflowHistoryParams {
	collectionSlug: string;
	id: string;
	limit?: number;
	page?: number;
	user?: UserContext;
}

export async function handleListWorkflowHistoryRequest(
	params: ListWorkflowHistoryParams,
): Promise<HandlerResult> {
	const resolved = resolveWorkflow(params.collectionSlug);
	if (!resolved.ok) return resolved.result;

	const api = getMomentumAPI();
	const config = api.getConfig();
	const adapter = config.db.adapter;
	if (!adapter.findWorkflowHistory) {
		return { status: 500, body: { error: 'Adapter does not implement workflow operations' } };
	}

	const contextApi = params.user ? api.setContext({ user: params.user }) : api;
	const ops = contextApi.collection<Record<string, unknown>>(params.collectionSlug);

	let doc: Record<string, unknown> | null;
	try {
		doc = await ops.findById(params.id);
	} catch (error) {
		if (error instanceof Error && error.name === 'AccessDeniedError') {
			return { status: 403, body: { error: 'Access denied' } };
		}
		if (error instanceof Error && error.name === 'DocumentNotFoundError') {
			return { status: 404, body: { error: 'Document not found' } };
		}
		return {
			status: 500,
			body: {
				error: 'Failed to read document',
				message: sanitizeErrorMessage(error, 'Unknown error'),
			},
		};
	}
	if (!doc) {
		return { status: 404, body: { error: 'Document not found' } };
	}

	try {
		// Per-stage readStage filtering. Resolve the visible stage set ONCE,
		// then push the predicate down to the adapter so counts and rows are
		// consistent across pages. Doing this app-side after a paginated
		// fetch would mix totals-across-pages with per-page suppressed counts
		// and break pagination math.
		const overrideAccess = contextApi.getContext().overrideAccess === true;
		const readStageMap = resolved.collection.workflow.access?.readStage;
		let visibleStages: string[] | undefined;
		if (!overrideAccess && readStageMap) {
			const reqContext = buildWorkflowReqContext(contextApi, params.user);
			const allStages = resolved.collection.workflow.stages.map((s) => s.id);
			const allowed = await Promise.all(
				allStages.map(async (stageId) => {
					const fn = readStageMap[stageId];
					if (!fn) return stageId;
					const ok = await fn({ req: reqContext, id: params.id });
					return ok ? stageId : null;
				}),
			);
			visibleStages = allowed.filter((s): s is string => s !== null);
		}

		const result = await adapter.findWorkflowHistory(params.collectionSlug, params.id, {
			limit: params.limit,
			page: params.page,
			visibleStages,
		});

		return { status: 200, body: result };
	} catch (error) {
		return {
			status: 500,
			body: {
				error: 'Failed to fetch workflow history',
				message: sanitizeErrorMessage(error, 'Unknown error'),
			},
		};
	}
}
