/**
 * Workflow Types for Momentum CMS
 *
 * Multi-stage content review workflows beyond draft/published. Each collection
 * may declare a single linear workflow (DAG) of named stages with role-based
 * transition access, hooks, and optional auto-publish/unpublish on stage entry.
 *
 * Workflow state lives on the document, not on versions: stages describe the
 * editorial position of the live record, while versions remain pure revisions.
 */

import type {
	AccessArgs,
	AccessFunction,
	HookArgs,
	RequestContext,
} from '../collections/collection.types';

// ============================================
// Stage Definitions
// ============================================

/** Visual hint for stage badges. Maps to admin theme tokens. */
export type WorkflowStageColor = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'violet';

/**
 * A single stage in a workflow. Stages form a directed graph via `transitions`;
 * self-loops are rejected by the validator.
 */
export interface WorkflowStage {
	/** Stable id used in storage and API. Must match `[a-z0-9][a-z0-9-]*`. */
	id: string;
	/** Human-readable label shown in admin UI. */
	label: string;
	/** Optional helper text shown in transition dialogs. */
	description?: string;
	/** Visual color for stage badge. Defaults to 'gray'. */
	color?: WorkflowStageColor;
	/** Stage ids reachable from this stage. */
	transitions: string[];
	/** Entering this stage triggers the existing publish flow on the document. */
	publishesOnEnter?: boolean;
	/** Entering this stage triggers the existing unpublish flow on the document. */
	unpublishesOnEnter?: boolean;
}

// ============================================
// Access Control
// ============================================

/** Args passed to workflow transition access functions. */
export interface WorkflowAccessArgs extends AccessArgs {
	/** Stage id the document is currently in. */
	from: string;
	/** Stage id the document is moving to. */
	to: string;
	/** The full document being transitioned. */
	doc: Record<string, unknown>;
}

export type WorkflowAccessFunction = (args: WorkflowAccessArgs) => boolean | Promise<boolean>;

// ============================================
// Hooks
// ============================================

/** Args passed to beforeTransition / afterTransition hooks. */
export interface WorkflowTransitionHookArgs extends HookArgs {
	from: string;
	to: string;
	comment?: string;
}

export type WorkflowTransitionHookFunction = (
	args: WorkflowTransitionHookArgs,
) => void | Promise<void>;

// ============================================
// Workflow Configuration
// ============================================

/**
 * Per-collection workflow config. A collection may define at most one workflow.
 * When configured, document-level publish endpoints are gated against the
 * configured `publishGateStage` (or any stage with `publishesOnEnter: true`).
 */
export interface WorkflowConfig {
	/** Ordered list of stages. Order is informational only — transitions are explicit. */
	stages: WorkflowStage[];
	/** Stage assigned to newly created documents. Must reference a defined stage id. */
	initialStage: string;
	/**
	 * Stage required for legacy publish endpoints to succeed. If omitted, any
	 * stage with `publishesOnEnter: true` is accepted.
	 */
	publishGateStage?: string;
	access?: {
		/** Gates `POST /:collection/:id/transition`. Composes AND with collection update access. */
		transition?: WorkflowAccessFunction;
		/**
		 * Per-stage read access. AND-composed with collection `access.read`.
		 * Denial returns 404 (not 403) to avoid leaking document existence.
		 */
		readStage?: Record<string, AccessFunction>;
	};
	hooks?: {
		beforeTransition?: WorkflowTransitionHookFunction[];
		afterTransition?: WorkflowTransitionHookFunction[];
	};
	/**
	 * Returns stage ids the request should be scoped to. Applied as a default
	 * `where[workflowStage][in]` filter that the caller may override explicitly.
	 */
	defaultStageFilter?: (req: RequestContext) => string[] | undefined;
}

// ============================================
// Runtime / Storage Types
// ============================================

/**
 * A row in the per-collection `<slug>_workflow_history` table. Every
 * transition writes one row. The creation of a workflow-enabled document
 * also writes one row with `fromStage = null` and `toStage = initialStage`,
 * via `adapter.recordWorkflowCreation`, so the audit trail always has an
 * anchor for "this doc came into existence at stage X."
 */
export interface WorkflowHistoryEntry {
	id: string;
	/** Document id this entry belongs to. */
	parent: string;
	/** Source stage. Null only for the initial creation row. */
	fromStage: string | null;
	/** Destination stage. */
	toStage: string;
	/** User id that performed the transition, when available. */
	userId?: string | null;
	/** Optional comment supplied by the user during transition. */
	comment?: string | null;
	/** ISO timestamp the transition was recorded. */
	createdAt: string;
}

/** Arguments accepted by transition handler. */
export interface TransitionDocumentOptions {
	toStage: string;
	comment?: string;
	/**
	 * Stage the client believes the document is currently in. Used for
	 * compare-and-swap concurrency control. Mismatch → 409 ConflictStaleStage.
	 */
	expectedStage?: string;
	/**
	 * Token the client received with the document. Used together with
	 * `expectedStage` for CAS. Mismatch → 409 ConflictStaleStage.
	 */
	expectedUpdatedAt?: string;
}

/** Result returned from a successful transition. */
export interface TransitionDocumentResult {
	id: string;
	fromStage: string;
	toStage: string;
	workflowUpdatedAt: string;
	historyId: string;
	/** True if this transition triggered the publish flow. */
	published: boolean;
	/** True if this transition triggered the unpublish flow. */
	unpublished: boolean;
}

/** Pagination options for workflow history queries. */
export interface WorkflowHistoryQueryOptions {
	limit?: number;
	page?: number;
	/**
	 * When provided, only history rows whose `fromStage` and `toStage` are
	 * both members of this set are returned (NULL `fromStage` from the
	 * initial-creation row is always allowed). Counts AND rows honour the
	 * filter, so totals stay consistent with what the caller can actually
	 * read. Used by the workflow handler to enforce per-stage readStage
	 * access without breaking pagination math.
	 */
	visibleStages?: string[];
}

/** Paginated history result mirroring the version query result shape. */
export interface WorkflowHistoryQueryResult {
	docs: WorkflowHistoryEntry[];
	totalDocs: number;
	totalPages: number;
	page: number;
	limit: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

// ============================================
// Error Codes (for typed API responses)
// ============================================

/** Stable error codes returned by the transition handler. */
export const WORKFLOW_ERROR_CODES = {
	InvalidTransition: 'WORKFLOW_INVALID_TRANSITION',
	ConflictStaleStage: 'WORKFLOW_CONFLICT_STALE_STAGE',
	PublishGateNotMet: 'WORKFLOW_PUBLISH_GATE_NOT_MET',
	UnknownStage: 'WORKFLOW_UNKNOWN_STAGE',
	WorkflowNotConfigured: 'WORKFLOW_NOT_CONFIGURED',
} as const;

export type WorkflowErrorCode = (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES];

// ============================================
// Utilities
// ============================================

/** Type guard: collection has a workflow configured. */
export function hasWorkflow(collection: {
	workflow?: WorkflowConfig;
}): collection is { workflow: WorkflowConfig } {
	return !!collection.workflow && Array.isArray(collection.workflow.stages);
}
