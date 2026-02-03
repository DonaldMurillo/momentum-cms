import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CommandFilterMode } from './command.types';

/**
 * Command component for building command palettes, autocomplete, and searchable lists.
 *
 * @example
 * ```html
 * <mcms-command>
 *   <mcms-command-input placeholder="Type a command or search..." />
 *   <mcms-command-list>
 *     <mcms-command-empty>No results found.</mcms-command-empty>
 *     <mcms-command-group label="Suggestions">
 *       <mcms-command-item value="calendar">Calendar</mcms-command-item>
 *       <mcms-command-item value="search">Search</mcms-command-item>
 *     </mcms-command-group>
 *   </mcms-command-list>
 * </mcms-command>
 * ```
 */
@Component({
	selector: 'mcms-command',
	host: {
		'[class]': 'hostClasses()',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Command {
	/** Filter mode for search/filter behavior */
	readonly filterMode = input<CommandFilterMode>('manual');

	/** Whether the command is disabled */
	readonly disabled = input(false);

	/** Whether the command list is always expanded */
	readonly alwaysExpanded = input(true);

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base =
			'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground';
		return `${base} ${this.class()}`.trim();
	});
}
