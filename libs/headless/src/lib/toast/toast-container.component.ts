import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HdlToastService } from './toast.service';
import { HdlToast } from './toast.component';

@Component({
	selector: 'hdl-toast-container',
	imports: [HdlToast],
	host: {
		'[attr.data-slot]': '"toast-container"',
		'[attr.data-position]': 'toastService.position()',
		'[attr.aria-live]': '"polite"',
		'[attr.aria-relevant]': '"additions removals"',
	},
	template: `
		@for (toast of toastService.toasts(); track toast.id) {
			<hdl-toast [toast]="toast" (dismissed)="toastService.dismiss(toast.id)">
				<div data-slot="toast-body">
					<div data-slot="toast-copy">
						<p data-slot="toast-title">{{ toast.title }}</p>
						@if (toast.description) {
							<p data-slot="toast-description">{{ toast.description }}</p>
						}
					</div>
					@if (toast.action || toast.dismissible) {
						<div data-slot="toast-actions">
							@if (toast.action; as action) {
								<button type="button" data-slot="toast-action" (click)="action.onClick()">
									{{ action.label }}
								</button>
							}
							@if (toast.dismissible) {
								<button
									type="button"
									data-slot="toast-dismiss"
									aria-label="Dismiss notification"
									(click)="toastService.dismiss(toast.id)"
								>
									Dismiss
								</button>
							}
						</div>
					}
				</div>
			</hdl-toast>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToastContainer {
	readonly toastService = inject(HdlToastService);
}
