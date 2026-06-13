import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { WorkflowConfig } from '@momentumcms/core';
import { Button } from '@momentumcms/ui';

/**
 * Stage filter pills — list-view filter rendering one toggle per workflow
 * stage plus an "All" pill. Emits `selectionChange` with the active stage id
 * (or `null` for All) so the parent list page can apply
 * `where[workflowStage][equals]=...` to its query.
 */
@Component({
	selector: 'mcms-stage-filter-pills',
	imports: [Button],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'inline-flex items-center gap-2 flex-wrap',
		role: 'group',
		'aria-label': 'Filter by workflow stage',
	},
	template: `
		<button
			mcms-button
			[variant]="active() === null ? 'primary' : 'outline'"
			size="sm"
			data-testid="stage-filter-all"
			(click)="onSelect(null)"
		>
			All
		</button>
		@for (stage of workflow().stages; track stage.id) {
			<button
				mcms-button
				[variant]="active() === stage.id ? 'primary' : 'outline'"
				size="sm"
				[attr.data-testid]="'stage-filter-' + stage.id"
				[attr.aria-pressed]="active() === stage.id"
				(click)="onSelect(stage.id)"
			>
				{{ stage.label }}
			</button>
		}
	`,
})
export class StageFilterPills {
	readonly workflow = input.required<WorkflowConfig>();
	readonly value = input<string | null>(null);
	readonly selectionChange = output<string | null>();

	readonly active = computed(() => this.value());

	onSelect(stageId: string | null): void {
		this.selectionChange.emit(stageId);
	}
}
