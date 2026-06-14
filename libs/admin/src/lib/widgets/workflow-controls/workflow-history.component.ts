import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	signal,
} from '@angular/core';
import type { WorkflowConfig, WorkflowHistoryEntry } from '@momentumcms/core';
import { Badge, Button, Spinner } from '@momentumcms/ui';
import { WorkflowService } from '../../services/workflow.service';

/**
 * Workflow history timeline.
 *
 * Renders the per-document audit trail produced by `transition` calls,
 * newest first. The parent edit page can pass `reloadKey` (or change it on
 * each `actionPerformed` event from `mcms-workflow-controls`) to force a
 * refresh without re-mounting the component.
 *
 * @example
 * ```html
 * <mcms-workflow-history
 *   [collection]="'articles'"
 *   [documentId]="docId"
 *   [workflow]="articleWorkflow"
 *   [reloadKey]="reloadKey()"
 * />
 * ```
 */
@Component({
	selector: 'mcms-workflow-history',
	imports: [DatePipe, Badge, Button, Spinner],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block',
	},
	template: `
		<section class="space-y-3" aria-label="Workflow history" data-testid="workflow-history">
			<header class="flex items-center justify-between">
				<h3 class="text-sm font-medium">Workflow history</h3>
				@if (isLoading()) {
					<mcms-spinner size="sm" aria-label="Loading history" />
				}
			</header>

			@if (errorMessage(); as msg) {
				<div
					role="alert"
					data-testid="workflow-history-error"
					class="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive-foreground"
				>
					<span class="flex-1">{{ msg }}</span>
					<button
						mcms-button
						variant="outline"
						size="sm"
						data-testid="workflow-history-retry"
						[disabled]="isLoading()"
						(click)="onRetry()"
					>
						Retry
					</button>
				</div>
			} @else if (entries().length === 0 && !isLoading()) {
				<p class="text-sm text-muted-foreground" data-testid="workflow-history-empty">
					No transitions recorded yet.
				</p>
			} @else {
				<ol class="space-y-2 border-l border-border pl-4">
					@for (entry of entries(); track entry.id) {
						<li class="relative pb-2" [attr.data-testid]="'workflow-history-entry-' + entry.id">
							<div class="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary"></div>
							<div class="flex flex-wrap items-center gap-2 text-sm">
								@if (entry.fromStage) {
									<mcms-badge variant="outline">{{ stageLabel(entry.fromStage) }}</mcms-badge>
									<span aria-hidden="true">→</span>
								}
								<mcms-badge variant="default">{{ stageLabel(entry.toStage) }}</mcms-badge>
								<span class="text-muted-foreground">
									{{ entry.createdAt | date: 'medium' }}
								</span>
								@if (entry.userId) {
									<span
										class="text-muted-foreground"
										[attr.data-testid]="'workflow-history-actor-' + entry.id"
									>
										&middot; by {{ entry.userId }}
									</span>
								} @else {
									<span
										class="italic text-muted-foreground"
										[attr.data-testid]="'workflow-history-actor-' + entry.id"
									>
										&middot; system
									</span>
								}
							</div>
							@if (entry.comment) {
								<p class="mt-1 text-sm text-muted-foreground">
									{{ entry.comment }}
								</p>
							}
						</li>
					}
				</ol>
			}
		</section>
	`,
})
export class WorkflowHistory {
	private readonly workflowService = inject(WorkflowService);

	readonly collection = input.required<string>();
	readonly documentId = input.required<string>();
	readonly workflow = input.required<WorkflowConfig>();
	/** Bump to force a reload — typically tied to `actionPerformed` from controls. */
	readonly reloadKey = input<number>(0);

	readonly entries = signal<WorkflowHistoryEntry[]>([]);
	readonly isLoading = signal(false);
	readonly errorMessage = signal<string | null>(null);

	private lastCollection: string | null = null;
	private lastDocId: string | null = null;

	private readonly stageLabelMap = computed(() => {
		const map = new Map<string, string>();
		for (const stage of this.workflow().stages) {
			map.set(stage.id, stage.label);
		}
		return map;
	});

	stageLabel(id: string): string {
		return this.stageLabelMap().get(id) ?? id;
	}

	constructor() {
		effect(() => {
			const collection = this.collection();
			const docId = this.documentId();
			// Track reloadKey explicitly so an unchanged collection/docId still refetches.
			void this.reloadKey();
			if (!collection || !docId) return;
			void this.refresh(collection, docId);
		});
	}

	onRetry(): void {
		const collection = this.lastCollection ?? this.collection();
		const docId = this.lastDocId ?? this.documentId();
		if (!collection || !docId) return;
		void this.refresh(collection, docId);
	}

	private async refresh(collection: string, docId: string): Promise<void> {
		this.lastCollection = collection;
		this.lastDocId = docId;
		this.isLoading.set(true);
		this.errorMessage.set(null);
		try {
			const result = await this.workflowService.listHistory(collection, docId, { limit: 50 });
			this.entries.set(result.docs);
		} catch (err) {
			// Surface a distinct error state so failure isn't conflated with
			// "no transitions recorded" — that mis-display could mask audit
			// gaps when a reviewer is denied or the server errors transiently.
			this.entries.set([]);
			this.errorMessage.set(this.describeError(err));
		} finally {
			this.isLoading.set(false);
		}
	}

	private describeError(err: unknown): string {
		if (err instanceof HttpErrorResponse) {
			if (err.status === 0) return 'Network error — workflow history unavailable.';
			if (err.status === 403) return 'You do not have access to this workflow history.';
			if (err.status === 404) return 'Workflow history not found for this document.';
			return `Could not load workflow history (HTTP ${err.status}).`;
		}
		return 'Could not load workflow history.';
	}
}
