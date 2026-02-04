import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { Toolbar as AriaToolbar } from '@angular/aria/toolbar';
import type { ToolbarOrientation } from './toolbar.types';

/**
 * Toolbar component for grouping related controls.
 *
 * Uses @angular/aria/toolbar for keyboard navigation (Arrow keys, Home/End).
 *
 * @example
 * ```html
 * <mcms-toolbar>
 *   <button mcms-toolbar-widget value="bold">Bold</button>
 *   <button mcms-toolbar-widget value="italic">Italic</button>
 *   <mcms-toolbar-separator />
 *   <button mcms-toolbar-widget value="link">Link</button>
 * </mcms-toolbar>
 * ```
 */
@Component({
	selector: 'mcms-toolbar',
	hostDirectives: [
		{
			directive: AriaToolbar,
			inputs: ['orientation', 'disabled', 'wrap', 'softDisabled', 'values'],
			outputs: ['valuesChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'toolbar',
		'[attr.aria-orientation]': 'orientation()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toolbar {
	protected readonly toolbar = inject(AriaToolbar);

	/** Toolbar orientation */
	readonly orientation = input<ToolbarOrientation>('horizontal');

	/** Whether the toolbar is disabled */
	readonly disabled = input(false);

	/** Whether navigation wraps around */
	readonly wrap = input(true);

	/** Selected widget values */
	readonly values = model<string[]>([]);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'inline-flex items-center gap-1 rounded-md border border-border bg-background p-1';
		const orientationClasses = this.orientation() === 'vertical' ? 'flex-col' : 'flex-row';
		return `${base} ${orientationClasses} ${this.class()}`.trim();
	});
}
