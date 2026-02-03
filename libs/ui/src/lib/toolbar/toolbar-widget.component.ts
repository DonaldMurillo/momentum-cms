import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ToolbarWidget as AriaToolbarWidget } from '@angular/aria/toolbar';

/**
 * Interactive widget within a toolbar.
 *
 * @example
 * ```html
 * <button mcms-toolbar-widget value="bold" (click)="toggleBold()">
 *   <svg>...</svg>
 * </button>
 * ```
 */
@Component({
	selector: 'button[mcms-toolbar-widget]',
	hostDirectives: [
		{
			directive: AriaToolbarWidget,
			inputs: ['value', 'disabled'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		type: 'button',
		'[attr.aria-pressed]': 'widget.selected() || null',
		'[attr.disabled]': 'disabled() || null',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarWidget {
	protected readonly widget = inject(AriaToolbarWidget);

	/** The value identifier for this widget */
	readonly value = input.required<string>();

	/** Whether the widget is disabled */
	readonly disabled = input(false);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base =
			'inline-flex items-center justify-center rounded-sm px-2.5 py-1.5 text-sm font-medium transition-colors';
		const interactiveClasses = this.disabled()
			? 'pointer-events-none opacity-50'
			: 'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none';
		const activeClasses = this.widget.active() ? 'bg-accent text-accent-foreground' : '';
		const selectedClasses = this.widget.selected()
			? 'bg-accent text-accent-foreground'
			: 'bg-transparent';
		return `${base} ${interactiveClasses} ${activeClasses} ${selectedClasses} ${this.class()}`.trim();
	});
}
