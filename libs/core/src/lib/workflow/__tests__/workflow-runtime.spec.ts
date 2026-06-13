import { describe, expect, it, vi } from 'vitest';
import type { AccessFunction } from '../../collections/collection.types';
import {
	canTransition,
	composeStageRead,
	findStage,
	requiresPublish,
	requiresUnpublish,
	satisfiesPublishGate,
} from '../workflow-runtime';
import type { WorkflowConfig } from '../workflow.types';

const config: WorkflowConfig = {
	stages: [
		{ id: 'draft', label: 'Draft', transitions: ['in-review'] },
		{ id: 'in-review', label: 'In Review', transitions: ['draft', 'approved'] },
		{
			id: 'approved',
			label: 'Approved',
			transitions: ['archived'],
			publishesOnEnter: true,
		},
		{
			id: 'archived',
			label: 'Archived',
			transitions: [],
			unpublishesOnEnter: true,
		},
	],
	initialStage: 'draft',
};

describe('findStage', () => {
	it('returns the stage when id matches', () => {
		expect(findStage(config, 'in-review')?.label).toBe('In Review');
	});

	it('returns undefined for unknown id', () => {
		expect(findStage(config, 'ghost')).toBeUndefined();
	});
});

describe('canTransition', () => {
	it('returns true for declared transition', () => {
		expect(canTransition(config, 'draft', 'in-review')).toBe(true);
		expect(canTransition(config, 'in-review', 'approved')).toBe(true);
	});

	it('returns false for undeclared transition', () => {
		expect(canTransition(config, 'draft', 'approved')).toBe(false);
	});

	it('returns false when from stage is unknown', () => {
		expect(canTransition(config, 'ghost', 'draft')).toBe(false);
	});

	it('returns false when to stage is unknown', () => {
		expect(canTransition(config, 'draft', 'ghost')).toBe(false);
	});

	it('returns false for terminal stage with no transitions', () => {
		expect(canTransition(config, 'archived', 'draft')).toBe(false);
	});
});

describe('requiresPublish', () => {
	it('returns true for publishesOnEnter stage', () => {
		expect(requiresPublish(config, 'approved')).toBe(true);
	});

	it('returns false for non-publishing stage', () => {
		expect(requiresPublish(config, 'draft')).toBe(false);
	});

	it('returns false for unknown stage', () => {
		expect(requiresPublish(config, 'ghost')).toBe(false);
	});
});

describe('requiresUnpublish', () => {
	it('returns true for unpublishesOnEnter stage', () => {
		expect(requiresUnpublish(config, 'archived')).toBe(true);
	});

	it('returns false for non-unpublishing stage', () => {
		expect(requiresUnpublish(config, 'draft')).toBe(false);
	});

	it('returns false for unknown stage', () => {
		expect(requiresUnpublish(config, 'ghost')).toBe(false);
	});
});

describe('satisfiesPublishGate', () => {
	it('uses configured publishGateStage when set', () => {
		const cfg: WorkflowConfig = { ...config, publishGateStage: 'in-review' };
		expect(satisfiesPublishGate(cfg, 'in-review')).toBe(true);
		expect(satisfiesPublishGate(cfg, 'approved')).toBe(false);
	});

	it('configured publishGateStage overrides publishesOnEnter fallback (does not OR)', () => {
		const cfg: WorkflowConfig = { ...config, publishGateStage: 'in-review' };
		expect(satisfiesPublishGate(cfg, 'approved')).toBe(false);
	});

	it('falls back to publishesOnEnter stages when publishGateStage absent', () => {
		expect(satisfiesPublishGate(config, 'approved')).toBe(true);
		expect(satisfiesPublishGate(config, 'draft')).toBe(false);
	});

	it('returns false for unknown stage', () => {
		expect(satisfiesPublishGate(config, 'ghost')).toBe(false);
	});
});

describe('composeStageRead', () => {
	const args = { req: {}, id: 'doc-1' };

	it('returns undefined when neither function is provided', () => {
		expect(composeStageRead(undefined, undefined)).toBeUndefined();
	});

	it('runs only the collection function when stage is absent', async () => {
		const collectionRead = vi.fn(() => true);
		const composed = composeStageRead(collectionRead, undefined);
		expect(composed).toBeDefined();
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(true);
		expect(collectionRead).toHaveBeenCalledOnce();
	});

	it('runs only the stage function when collection is absent', async () => {
		const stageRead = vi.fn(() => true);
		const composed = composeStageRead(undefined, stageRead);
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(true);
		expect(stageRead).toHaveBeenCalledOnce();
	});

	it('AND-composes — both must pass and both must run on success', async () => {
		const collectionRead: AccessFunction = vi.fn(() => true);
		const stageRead: AccessFunction = vi.fn(() => true);
		const composed = composeStageRead(collectionRead, stageRead);
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(true);
		expect(collectionRead).toHaveBeenCalledOnce();
		expect(stageRead).toHaveBeenCalledOnce();
	});

	it('rejects when collection access denies', async () => {
		const collectionRead: AccessFunction = () => false;
		const stageRead: AccessFunction = vi.fn(() => true);
		const composed = composeStageRead(collectionRead, stageRead);
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(false);
		expect(stageRead).not.toHaveBeenCalled();
	});

	it('rejects when stage access denies even if collection allows', async () => {
		const composed = composeStageRead(
			() => true,
			() => false,
		);
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(false);
	});

	it('awaits async access functions', async () => {
		const composed = composeStageRead(
			async () => true,
			async () => true,
		);
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(true);
	});

	it('rejects when async collection access resolves false', async () => {
		const composed = composeStageRead(
			async () => false,
			async () => true,
		);
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(false);
	});

	it('rejects when async stage access resolves false', async () => {
		const composed = composeStageRead(
			async () => true,
			async () => false,
		);
		await expect((composed as NonNullable<typeof composed>)(args)).resolves.toBe(false);
	});
});
