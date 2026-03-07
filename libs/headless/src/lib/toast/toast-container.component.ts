import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HdlToastService } from './toast.service';
import { HdlToast } from './toast.component';

@Component({
	selector: 'hdl-toast-container',
	imports: [HdlToast],
	host: {
		'[attr.aria-live]': '"polite"',
		'[attr.aria-relevant]': '"additions removals"',
	},
	template: `
		@for (toast of toastService.toasts(); track toast.id) {
			<hdl-toast [toast]="toast" (dismissed)="toastService.dismiss(toast.id)" />
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToastContainer {
	readonly toastService = inject(HdlToastService);
}
