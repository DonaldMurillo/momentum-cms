import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Toast } from './toast.types';

@Component({
	selector: 'hdl-toast',
	host: {
		'[attr.data-slot]': '"toast"',
		'[attr.data-variant]': 'toast().variant',
		'[attr.data-dismissible]': 'toast().dismissible ? "true" : "false"',
		role: 'status',
		'[attr.aria-atomic]': 'true',
	},
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToast {
	readonly toast = input.required<Toast>();
	readonly dismissed = output<void>();

	dismiss(): void {
		this.dismissed.emit();
	}
}
