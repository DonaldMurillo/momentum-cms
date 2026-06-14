/**
 * Workflow config validators.
 *
 * Run at collection definition time (via `defineCollection`) so misconfigured
 * workflows fail at boot, not at first transition. All errors include the
 * offending value so the developer can locate it without re-reading the spec.
 */

import type { WorkflowConfig } from './workflow.types';

export const STAGE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export class WorkflowConfigError extends Error {
	constructor(message: string) {
		super(`[workflow] ${message}`);
		this.name = 'WorkflowConfigError';
	}
}

/**
 * Re-assert the stage id is safe to interpolate into raw SQL DDL.
 *
 * Adapters that hand-build `ALTER TABLE ... DEFAULT '<stage>'` statements
 * (Postgres can't parameterise DEFAULT) call this immediately before the
 * interpolation. The same pattern is enforced at config-validation time, so
 * a violation here means something stripped or bypassed `validateWorkflowConfig`
 * — fail loud rather than risk emitting attacker-controlled SQL.
 */
export function assertStageIdSafeForSql(stageId: string): void {
	if (typeof stageId !== 'string' || !STAGE_ID_PATTERN.test(stageId)) {
		throw new WorkflowConfigError(
			`stage id "${stageId}" failed STAGE_ID_PATTERN at SQL interpolation site — refusing to emit DDL`,
		);
	}
}

/**
 * Validate a workflow config. Throws `WorkflowConfigError` on the first
 * problem found so the boot trace points at the actual issue.
 *
 * Caller passes the collection slug for clearer error context.
 */
export function validateWorkflowConfig(config: WorkflowConfig, collectionSlug: string): void {
	const ctx = `collection "${collectionSlug}"`;

	if (!Array.isArray(config.stages) || config.stages.length === 0) {
		throw new WorkflowConfigError(`${ctx}: stages must be a non-empty array`);
	}

	const seenIds = new Set<string>();
	for (const stage of config.stages) {
		if (typeof stage.id !== 'string' || !STAGE_ID_PATTERN.test(stage.id)) {
			throw new WorkflowConfigError(
				`${ctx}: stage id "${stage.id}" must match ${STAGE_ID_PATTERN}`,
			);
		}
		if (seenIds.has(stage.id)) {
			throw new WorkflowConfigError(`${ctx}: duplicate stage id "${stage.id}"`);
		}
		seenIds.add(stage.id);

		if (typeof stage.label !== 'string' || stage.label.trim() === '') {
			throw new WorkflowConfigError(`${ctx}: stage "${stage.id}" must have a non-empty label`);
		}

		if (!Array.isArray(stage.transitions)) {
			throw new WorkflowConfigError(`${ctx}: stage "${stage.id}" transitions must be an array`);
		}

		if (stage.publishesOnEnter && stage.unpublishesOnEnter) {
			throw new WorkflowConfigError(
				`${ctx}: stage "${stage.id}" cannot both publish and unpublish on enter`,
			);
		}
	}

	for (const stage of config.stages) {
		const seenTargets = new Set<string>();
		for (const target of stage.transitions) {
			if (target === stage.id) {
				throw new WorkflowConfigError(`${ctx}: stage "${stage.id}" cannot transition to itself`);
			}
			if (!seenIds.has(target)) {
				throw new WorkflowConfigError(
					`${ctx}: stage "${stage.id}" transitions to unknown stage "${target}"`,
				);
			}
			if (seenTargets.has(target)) {
				throw new WorkflowConfigError(
					`${ctx}: stage "${stage.id}" lists transition "${target}" more than once`,
				);
			}
			seenTargets.add(target);
		}
	}

	if (!seenIds.has(config.initialStage)) {
		throw new WorkflowConfigError(
			`${ctx}: initialStage "${config.initialStage}" is not a defined stage`,
		);
	}

	if (config.publishGateStage !== undefined && !seenIds.has(config.publishGateStage)) {
		throw new WorkflowConfigError(
			`${ctx}: publishGateStage "${config.publishGateStage}" is not a defined stage`,
		);
	}

	if (config.access?.readStage) {
		for (const stageId of Object.keys(config.access.readStage)) {
			if (!seenIds.has(stageId)) {
				throw new WorkflowConfigError(
					`${ctx}: access.readStage references unknown stage "${stageId}"`,
				);
			}
		}
	}
}
