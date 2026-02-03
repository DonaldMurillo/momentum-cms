import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Dropdown menu separator component.
 *
 * Usage:
 * ```html
 * <mcms-dropdown-separator />
 * ```
 */
@Component({
	selector: 'mcms-dropdown-separator',
	host: {
		role: 'separator',
	},
	template: '',
	styles: `
		:host {
			display: block;
			height: 1px;
			margin: 0.25rem -0.25rem;
			background-color: hsl(var(--mcms-border));
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownSeparator {}
