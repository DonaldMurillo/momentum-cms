import { describe, expect, it } from 'vitest';
import {
	assertStageIdSafeForSql,
	validateWorkflowConfig,
	WorkflowConfigError,
} from '../workflow-validators';
import type { WorkflowConfig } from '../workflow.types';

const baseStages = (): WorkflowConfig['stages'] => [
	{ id: 'draft', label: 'Draft', transitions: ['in-review'] },
	{ id: 'in-review', label: 'In Review', transitions: ['draft', 'approved'] },
	{ id: 'approved', label: 'Approved', transitions: ['in-review'], publishesOnEnter: true },
];

const validConfig = (): WorkflowConfig => ({
	stages: baseStages(),
	initialStage: 'draft',
});

describe('validateWorkflowConfig', () => {
	it('accepts a well-formed config', () => {
		expect(() => validateWorkflowConfig(validConfig(), 'articles')).not.toThrow();
	});

	it('accepts publishGateStage when it references a defined stage', () => {
		const cfg = validConfig();
		cfg.publishGateStage = 'approved';
		expect(() => validateWorkflowConfig(cfg, 'articles')).not.toThrow();
	});

	it('accepts readStage map when keys reference defined stages', () => {
		const cfg = validConfig();
		cfg.access = { readStage: { draft: () => true, 'in-review': () => true } };
		expect(() => validateWorkflowConfig(cfg, 'articles')).not.toThrow();
	});

	it('rejects empty stages array', () => {
		const cfg: WorkflowConfig = { stages: [], initialStage: 'draft' };
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(WorkflowConfigError);
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/non-empty array/);
	});

	it('rejects non-array stages', () => {
		const cfg = { stages: 'nope', initialStage: 'draft' } as unknown as WorkflowConfig;
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/non-empty array/);
	});

	it('rejects stage id with invalid characters', () => {
		const cfg: WorkflowConfig = {
			stages: [{ id: 'In_Review', label: 'In Review', transitions: [] }],
			initialStage: 'In_Review',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/must match/);
	});

	it('rejects non-string stage id', () => {
		const cfg = {
			stages: [{ id: 42, label: 'Draft', transitions: [] }],
			initialStage: '42',
		} as unknown as WorkflowConfig;
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/must match/);
	});

	it('rejects non-string stage label', () => {
		const cfg = {
			stages: [{ id: 'draft', label: null, transitions: [] }],
			initialStage: 'draft',
		} as unknown as WorkflowConfig;
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/non-empty label/);
	});

	it('rejects stage id starting with hyphen', () => {
		const cfg: WorkflowConfig = {
			stages: [{ id: '-draft', label: 'Draft', transitions: [] }],
			initialStage: '-draft',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/must match/);
	});

	it('rejects duplicate stage ids', () => {
		const cfg: WorkflowConfig = {
			stages: [
				{ id: 'draft', label: 'A', transitions: [] },
				{ id: 'draft', label: 'B', transitions: [] },
			],
			initialStage: 'draft',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/duplicate stage id/);
	});

	it('rejects empty stage label', () => {
		const cfg: WorkflowConfig = {
			stages: [{ id: 'draft', label: '   ', transitions: [] }],
			initialStage: 'draft',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/non-empty label/);
	});

	it('rejects non-array transitions on a stage', () => {
		const cfg = {
			stages: [{ id: 'draft', label: 'Draft', transitions: 'in-review' }],
			initialStage: 'draft',
		} as unknown as WorkflowConfig;
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/transitions must be an array/);
	});

	it('rejects self-loop transition', () => {
		const cfg: WorkflowConfig = {
			stages: [{ id: 'draft', label: 'Draft', transitions: ['draft'] }],
			initialStage: 'draft',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/cannot transition to itself/);
	});

	it('rejects transition to unknown stage', () => {
		const cfg: WorkflowConfig = {
			stages: [{ id: 'draft', label: 'Draft', transitions: ['ghost'] }],
			initialStage: 'draft',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/unknown stage "ghost"/);
	});

	it('rejects duplicate transition target on the same stage', () => {
		const cfg: WorkflowConfig = {
			stages: [
				{ id: 'draft', label: 'Draft', transitions: ['in-review', 'in-review'] },
				{ id: 'in-review', label: 'In Review', transitions: [] },
			],
			initialStage: 'draft',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/more than once/);
	});

	it('rejects stage that both publishes and unpublishes on enter', () => {
		const cfg: WorkflowConfig = {
			stages: [
				{
					id: 'limbo',
					label: 'Limbo',
					transitions: [],
					publishesOnEnter: true,
					unpublishesOnEnter: true,
				},
			],
			initialStage: 'limbo',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(
			/cannot both publish and unpublish/,
		);
	});

	it('rejects initialStage not in stages', () => {
		const cfg: WorkflowConfig = {
			stages: baseStages(),
			initialStage: 'ghost',
		};
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/initialStage "ghost"/);
	});

	it('rejects publishGateStage not in stages', () => {
		const cfg = validConfig();
		cfg.publishGateStage = 'ghost';
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/publishGateStage "ghost"/);
	});

	it('rejects readStage map referencing unknown stage', () => {
		const cfg = validConfig();
		cfg.access = { readStage: { ghost: () => true } };
		expect(() => validateWorkflowConfig(cfg, 'articles')).toThrow(/unknown stage "ghost"/);
	});

	it('includes the collection slug in the error message', () => {
		const cfg: WorkflowConfig = { stages: [], initialStage: 'draft' };
		expect(() => validateWorkflowConfig(cfg, 'my-articles')).toThrow(/collection "my-articles"/);
	});
});

// Red-team finding #5: a future plugin that mutates a workflow config AFTER
// validateWorkflowConfig has run could ship a malicious initial stage straight
// into the Postgres adapter's `ALTER TABLE ... DEFAULT '<stage>'` interpolation.
// assertStageIdSafeForSql is the local guard the adapter calls right before it
// builds the DDL string — and it must reject anything the pattern rejects.
describe('assertStageIdSafeForSql', () => {
	it('passes well-formed stage ids', () => {
		expect(() => assertStageIdSafeForSql('draft')).not.toThrow();
		expect(() => assertStageIdSafeForSql('in-review')).not.toThrow();
		expect(() => assertStageIdSafeForSql('approved')).not.toThrow();
		expect(() => assertStageIdSafeForSql('stage-1')).not.toThrow();
	});

	it('rejects SQL meta characters', () => {
		expect(() => assertStageIdSafeForSql("draft'; DROP TABLE users; --")).toThrow(
			WorkflowConfigError,
		);
		expect(() => assertStageIdSafeForSql("draft' OR '1'='1")).toThrow(WorkflowConfigError);
		expect(() => assertStageIdSafeForSql('draft;DROP')).toThrow(WorkflowConfigError);
	});

	it('rejects uppercase, spaces, and other non-pattern chars', () => {
		expect(() => assertStageIdSafeForSql('Draft')).toThrow(WorkflowConfigError);
		expect(() => assertStageIdSafeForSql('in review')).toThrow(WorkflowConfigError);
		expect(() => assertStageIdSafeForSql('draft\n')).toThrow(WorkflowConfigError);
		expect(() => assertStageIdSafeForSql('')).toThrow(WorkflowConfigError);
		expect(() => assertStageIdSafeForSql('-leading-dash')).toThrow(WorkflowConfigError);
	});

	it('rejects non-string values defensively', () => {
		expect(() => assertStageIdSafeForSql(null as unknown as string)).toThrow(WorkflowConfigError);
		expect(() => assertStageIdSafeForSql(123 as unknown as string)).toThrow(WorkflowConfigError);
	});
});
