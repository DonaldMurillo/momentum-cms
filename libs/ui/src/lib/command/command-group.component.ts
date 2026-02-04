import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Groups related command items together with an optional label.
 *
 * @example
 * ```html
 * <mcms-command-group label="Settings">
 *   <mcms-command-item value="profile">Profile</mcms-command-item>
 *   <mcms-command-item value="billing">Billing</mcms-command-item>
 * </mcms-command-group>
 * ```
 */
@Component({
	selector: 'mcms-command-group',
	host: {
		'[class]': 'hostClasses()',
		role: 'group',
	},
	template: `
		@if (label()) {
			<div [class]="labelClasses()">{{ label() }}</div>
		}
		<ng-content />
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandGroup {
	/** Label for the group */
	readonly label = input<string>();

	/** Additional CSS classes */
	readonly class = input('');

	protected readonly hostClasses = computed(() => {
		const base = 'overflow-hidden p-1 text-foreground';
		return `${base} ${this.class()}`.trim();
	});

	protected readonly labelClasses = computed(() => {
		return 'px-2 py-1.5 text-xs font-medium text-muted-foreground';
	});
}
