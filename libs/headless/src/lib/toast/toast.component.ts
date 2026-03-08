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
	template: `
		<div data-slot="toast-body">
			<div data-slot="toast-copy">
				<p data-slot="toast-title">{{ toast().title }}</p>
				@if (toast().description) {
					<p data-slot="toast-description">{{ toast().description }}</p>
				}
			</div>
			@if (toast().action || toast().dismissible) {
				<div data-slot="toast-actions">
					@if (toast().action; as action) {
						<button type="button" data-slot="toast-action" (click)="runAction(action.onClick)">
							{{ action.label }}
						</button>
					}
					@if (toast().dismissible) {
						<button
							type="button"
							data-slot="toast-dismiss"
							aria-label="Dismiss notification"
							(click)="dismiss()"
						>
							Dismiss
						</button>
					}
				</div>
			}
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToast {
	readonly toast = input.required<Toast>();
	readonly dismissed = output<void>();

	runAction(action: () => void): void {
		action();
	}

	dismiss(): void {
		this.dismissed.emit();
	}
}
