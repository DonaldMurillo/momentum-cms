import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Badge } from '@momentumcms/ui';
import type { BadgeVariant } from '@momentumcms/ui';
import type { WorkflowStage, WorkflowStageColor } from '@momentumcms/core';

const COLOR_TO_VARIANT: Record<WorkflowStageColor, BadgeVariant> = {
	gray: 'secondary',
	blue: 'default',
	amber: 'warning',
	green: 'success',
	red: 'destructive',
	violet: 'outline',
};

/**
 * Workflow stage badge — shows the current stage label with a color-mapped
 * Badge variant. Falls back to `secondary` when the stage has no color hint.
 *
 * @example
 * ```html
 * <mcms-stage-badge [stage]="currentStage" />
 * ```
 */
@Component({
	selector: 'mcms-stage-badge',
	imports: [Badge],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'inline-flex',
		'aria-label': 'Workflow stage',
	},
	template: `
		<mcms-badge [variant]="variant()" data-testid="workflow-stage-badge">
			{{ stage()?.label ?? 'Unknown' }}
		</mcms-badge>
	`,
})
export class StageBadge {
	readonly stage = input<WorkflowStage | undefined>();

	readonly variant = computed<BadgeVariant>(() => {
		const color = this.stage()?.color;
		return color ? COLOR_TO_VARIANT[color] : 'secondary';
	});
}
