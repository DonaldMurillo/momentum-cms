import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Listbox } from '@angular/aria/listbox';

let nextListId = 0;

/**
 * Container for command items. Provides the scrollable list area.
 *
 * @example
 * ```html
 * <mcms-command-list>
 *   <mcms-command-item value="item1">Item 1</mcms-command-item>
 *   <mcms-command-item value="item2">Item 2</mcms-command-item>
 * </mcms-command-list>
 * ```
 */
@Component({
	selector: 'mcms-command-list',
	hostDirectives: [
		{
			directive: Listbox,
			inputs: ['multi', 'wrap', 'focusMode', 'selectionMode', 'disabled', 'values'],
			outputs: ['valuesChange'],
		},
	],
	host: {
		'[class]': 'hostClasses()',
		'[attr.id]': 'listId',
		role: 'listbox',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandList {
	/** Auto-generated unique ID for ARIA association with CommandInput. */
	readonly listId = `mcms-command-list-${nextListId++}`;

	/** Maximum height of the list */
	readonly maxHeight = input('300px');

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'max-h-[300px] overflow-y-auto overflow-x-hidden';
		return `${base} ${this.class()}`.trim();
	});
}
