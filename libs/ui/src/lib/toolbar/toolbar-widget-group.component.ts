import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ToolbarWidgetGroup as AriaToolbarWidgetGroup } from '@angular/aria/toolbar';

/**
 * Groups toolbar widgets for selection (like radio buttons).
 *
 * @example
 * ```html
 * <mcms-toolbar-widget-group [(value)]="alignment">
 *   <button mcms-toolbar-widget value="left">Left</button>
 *   <button mcms-toolbar-widget value="center">Center</button>
 *   <button mcms-toolbar-widget value="right">Right</button>
 * </mcms-toolbar-widget-group>
 * ```
 */
@Component({
	selector: 'mcms-toolbar-widget-group',
	hostDirectives: [
		{
			directive: AriaToolbarWidgetGroup,
			inputs: ['disabled', 'multi'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'group',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarWidgetGroup {
	protected readonly group = inject(AriaToolbarWidgetGroup);

	/** Whether the group is disabled */
	readonly disabled = input(false);

	/** Whether multiple items can be selected */
	readonly multi = input(false);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'inline-flex items-center gap-0.5 rounded-sm bg-muted p-0.5';
		return `${base} ${this.class()}`.trim();
	});
}
