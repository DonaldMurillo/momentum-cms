import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import type { WorkflowConfig, WorkflowStage } from '@momentumcms/core';
import { Button, DialogService, ToastService } from '@momentumcms/ui';
import { WorkflowService } from '../../services/workflow.service';
import { StageBadge } from './stage-badge.component';
import {
	TransitionDialogComponent,
	type TransitionDialogData,
	type TransitionDialogResult,
} from './transition-dialog.component';

function parseConflictBody(
	raw: unknown,
): { currentStage?: string; currentUpdatedAt?: string } | null {
	if (!raw || typeof raw !== 'object') return null;
	const stageVal: unknown = Reflect.get(raw, 'currentStage');
	const updatedAtVal: unknown = Reflect.get(raw, 'currentUpdatedAt');
	const stage = typeof stageVal === 'string' ? stageVal : undefined;
	const updatedAt = typeof updatedAtVal === 'string' ? updatedAtVal : undefined;
	return { currentStage: stage, currentUpdatedAt: updatedAt };
}

/**
 * Workflow controls — current stage badge plus a button per declared transition.
 * Each button opens a confirmation dialog; on confirm the component calls
 * `WorkflowService.transition`, refreshes the local state, and emits
 * `actionPerformed` so the parent edit page can refresh related widgets
 * (history timeline, publish status badge).
 *
 * Stale-stage 409 responses surface a warning toast and trigger a refresh of
 * the local stage so the user can re-attempt against the current state.
 *
 * @example
 * ```html
 * <mcms-workflow-controls
 *   [collection]="'articles'"
 *   [documentId]="docId"
 *   [workflow]="articleWorkflow"
 *   [currentStage]="stage"
 *   [workflowUpdatedAt]="updatedAt"
 *   (actionPerformed)="refreshHistory()"
 * />
 * ```
 */
@Component({
	selector: 'mcms-workflow-controls',
	imports: [Button, StageBadge],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'inline-flex items-center gap-3 flex-wrap',
		role: 'group',
		'aria-label': 'Workflow controls',
	},
	template: `
		<mcms-stage-badge [stage]="currentStageObj()" />

		@for (target of allowedTransitions(); track target.id) {
			<button
				mcms-button
				variant="outline"
				size="sm"
				[disabled]="isUpdating()"
				[attr.aria-busy]="isUpdating() ? 'true' : null"
				[attr.aria-label]="'Move to ' + target.label"
				[attr.data-testid]="'transition-to-' + target.id"
				(click)="onTransition(target)"
			>
				<span aria-hidden="true">→</span>&nbsp;{{ target.label }}
			</button>
		}

		@if (allowedTransitions().length === 0 && currentStageObj()) {
			<span class="text-xs text-muted-foreground" data-testid="workflow-no-transitions">
				No transitions available from this stage.
			</span>
		}
	`,
})
export class WorkflowControls {
	private readonly workflowService = inject(WorkflowService);
	private readonly toast = inject(ToastService);
	private readonly dialogService = inject(DialogService);

	readonly collection = input.required<string>();
	readonly documentId = input.required<string>();
	readonly workflow = input.required<WorkflowConfig>();
	readonly currentStage = input.required<string>();
	readonly workflowUpdatedAt = input<string | undefined>(undefined);

	readonly actionPerformed = output<{ from: string; to: string }>();
	readonly stageChanged = output<{ stage: string; updatedAt: string }>();

	readonly isUpdating = signal(false);
	private readonly localStage = signal<string | null>(null);
	private readonly localUpdatedAt = signal<string | null>(null);

	readonly currentStageObj = computed<WorkflowStage | undefined>(() => {
		const stageId = this.localStage() ?? this.currentStage();
		return this.workflow().stages.find((s) => s.id === stageId);
	});

	readonly allowedTransitions = computed<WorkflowStage[]>(() => {
		const stage = this.currentStageObj();
		if (!stage) return [];
		const targets = new Set(stage.transitions);
		return this.workflow().stages.filter((s) => targets.has(s.id));
	});

	constructor() {
		effect(() => {
			this.localStage.set(this.currentStage());
			const ts = this.workflowUpdatedAt();
			this.localUpdatedAt.set(ts ?? null);
		});
	}

	async onTransition(target: WorkflowStage): Promise<void> {
		const fromStage = this.currentStageObj();
		if (!fromStage) return;

		const data: TransitionDialogData = {
			fromLabel: fromStage.label,
			toLabel: target.label,
			toDescription: target.description,
			willPublish: target.publishesOnEnter === true,
			willUnpublish: target.unpublishesOnEnter === true,
		};

		const ref = this.dialogService.open<
			TransitionDialogComponent,
			TransitionDialogData,
			TransitionDialogResult
		>(TransitionDialogComponent, { data });
		const result = await firstValueFrom(ref.afterClosed);
		if (!result) return;

		this.isUpdating.set(true);
		try {
			const transition = await this.workflowService.transition(
				this.collection(),
				this.documentId(),
				{
					toStage: target.id,
					comment: result.comment || undefined,
					expectedStage: this.localStage() ?? this.currentStage(),
					expectedUpdatedAt: this.localUpdatedAt() ?? this.workflowUpdatedAt(),
				},
			);
			this.localStage.set(transition.toStage);
			this.localUpdatedAt.set(transition.workflowUpdatedAt);
			this.toast.success(`Moved to ${target.label}`);
			this.stageChanged.emit({
				stage: transition.toStage,
				updatedAt: transition.workflowUpdatedAt,
			});
			this.actionPerformed.emit({ from: transition.fromStage, to: transition.toStage });
		} catch (err) {
			this.handleTransitionError(err, target);
		} finally {
			this.isUpdating.set(false);
		}
	}

	private handleTransitionError(err: unknown, target: WorkflowStage): void {
		if (err instanceof HttpErrorResponse && err.status === 409) {
			const body = parseConflictBody(err.error);
			if (body?.currentStage) {
				this.localStage.set(body.currentStage);
				if (body.currentUpdatedAt) this.localUpdatedAt.set(body.currentUpdatedAt);
				this.stageChanged.emit({
					stage: body.currentStage,
					updatedAt: body.currentUpdatedAt ?? new Date().toISOString(),
				});
			}
			this.toast.warning('Stage changed', 'Refreshed to the latest state. Try again.');
			return;
		}
		this.toast.error(`Could not move to ${target.label}`, this.describeTransitionError(err));
	}

	private describeTransitionError(err: unknown): string {
		if (!(err instanceof HttpErrorResponse)) return String(err);
		if (err.status === 403) return "You don't have permission to perform this transition.";
		if (err.status === 404) return 'Document no longer exists.';
		if (err.status === 0) return 'Network error — please try again.';
		// Server messages are sanitized by sanitizeErrorMessage on the server,
		// but fall back to a generic string for 5xx to avoid surfacing
		// "Access check failed" or other internal phrasing to end users.
		if (err.status >= 500) return 'Server error — please try again or contact support.';
		const serverMsg = typeof err.error?.message === 'string' ? err.error.message : null;
		return serverMsg ?? err.message;
	}
}
