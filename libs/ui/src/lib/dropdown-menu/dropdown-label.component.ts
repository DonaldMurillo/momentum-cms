import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Dropdown menu label component.
 *
 * Usage:
 * ```html
 * <mcms-dropdown-label>Actions</mcms-dropdown-label>
 * ```
 */
@Component({
	selector: 'mcms-dropdown-label',
	host: {
		class: 'block',
	},
	template: `<ng-content />`,
	styles: `
		:host {
			display: block;
			padding: 0.375rem 0.5rem;
			font-size: 0.75rem;
			font-weight: 600;
			color: hsl(var(--mcms-muted-foreground));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownLabel {}
