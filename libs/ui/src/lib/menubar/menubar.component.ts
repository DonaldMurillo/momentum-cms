import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { MenuBar as AriaMenuBar } from '@angular/aria/menu';

/**
 * Application menu bar for File, Edit, View style menus.
 *
 * Uses @angular/aria/menu for keyboard navigation (Arrow keys, Enter/Space).
 *
 * @example
 * ```html
 * <mcms-menubar>
 *   <mcms-menubar-item value="file" label="File" [submenu]="fileMenu">
 *     <mcms-menubar-submenu #fileMenu>
 *       <mcms-menubar-item value="new" label="New" shortcut="⌘N" />
 *       <mcms-menubar-item value="open" label="Open" shortcut="⌘O" />
 *     </mcms-menubar-submenu>
 *   </mcms-menubar-item>
 *   <mcms-menubar-item value="edit" label="Edit" [submenu]="editMenu">
 *     ...
 *   </mcms-menubar-item>
 * </mcms-menubar>
 * ```
 */
@Component({
	selector: 'mcms-menubar',
	exportAs: 'mcmsMenubar',
	hostDirectives: [
		{
			directive: AriaMenuBar,
			inputs: ['disabled', 'wrap', 'typeaheadDelay', 'values'],
			outputs: ['valuesChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		role: 'menubar',
		'[attr.aria-orientation]': '"horizontal"',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menubar {
	readonly menubar = inject(AriaMenuBar);

	/** Whether the menubar is disabled */
	readonly disabled = input(false);

	/** Whether navigation wraps around */
	readonly wrap = input(true);

	/** Typeahead delay in milliseconds */
	readonly typeaheadDelay = input(500);

	/** Selected values (for checkable menu items) */
	readonly values = model<string[]>([]);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'flex items-center gap-1 rounded-md border border-border bg-background p-1';
		return `${base} ${this.class()}`.trim();
	});
}
