/**
 * Workflow runtime helpers — pure functions used by handlers and admin UI.
 *
 * No I/O, no side effects: makes the unit suite trivially exhaustive.
 */

import type { AccessFunction } from '../collections/collection.types';
import type { WorkflowConfig, WorkflowStage } from './workflow.types';

/** Look up a stage by id. Returns undefined for unknown ids. */
export function findStage(config: WorkflowConfig, stageId: string): WorkflowStage | undefined {
	return config.stages.find((stage) => stage.id === stageId);
}

/**
 * Whether `from` → `to` is a declared transition. Returns false when either
 * stage is unknown so handlers can map both invalid-transition and
 * unknown-stage cases through a single check.
 */
export function canTransition(config: WorkflowConfig, from: string, to: string): boolean {
	const fromStage = findStage(config, from);
	const toStage = findStage(config, to);
	if (!fromStage || !toStage) return false;
	return fromStage.transitions.includes(to);
}

/** Whether entering this stage should trigger the publish flow. */
export function requiresPublish(config: WorkflowConfig, stageId: string): boolean {
	return findStage(config, stageId)?.publishesOnEnter === true;
}

/** Whether entering this stage should trigger the unpublish flow. */
export function requiresUnpublish(config: WorkflowConfig, stageId: string): boolean {
	return findStage(config, stageId)?.unpublishesOnEnter === true;
}

/**
 * Whether the document's current stage satisfies the publish gate. When no
 * `publishGateStage` is configured, any `publishesOnEnter` stage qualifies.
 */
export function satisfiesPublishGate(config: WorkflowConfig, stageId: string): boolean {
	if (config.publishGateStage) return stageId === config.publishGateStage;
	return requiresPublish(config, stageId);
}

/**
 * Compose a stage-scoped read access function with the collection-level read
 * access. Both must pass for the document to be visible. If neither is
 * configured, returns undefined so callers can short-circuit.
 *
 * AND semantics are enforced: if either function rejects, the composition
 * rejects. This prevents accidental access widening when stage rules add
 * narrower constraints on top of collection-level rules.
 */
export function composeStageRead(
	collectionRead: AccessFunction | undefined,
	stageRead: AccessFunction | undefined,
): AccessFunction | undefined {
	if (!collectionRead && !stageRead) return undefined;
	return async (args) => {
		if (collectionRead) {
			const ok = await collectionRead(args);
			if (!ok) return false;
		}
		if (stageRead) {
			const ok = await stageRead(args);
			if (!ok) return false;
		}
		return true;
	};
}
