import { ChangeDetectionStrategy, Component, inject, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HdlToastService } from './toast.service';
import { HdlToast } from './toast.component';
import type { Toast } from './toast.types';

export interface HdlToastContext {
	$implicit: Toast;
	dismiss: (id: string) => void;
}

@Component({
	selector: 'hdl-toast-container',
	imports: [HdlToast, NgTemplateOutlet],
	host: {
		'[attr.data-slot]': '"toast-container"',
		'[attr.data-position]': 'toastService.position()',
		'[attr.aria-live]': '"polite"',
		'[attr.aria-relevant]': '"additions removals"',
	},
	template: `
		@for (toast of toastService.toasts(); track toast.id) {
			<hdl-toast [toast]="toast" (dismissed)="toastService.dismiss(toast.id)">
				<ng-container
					[ngTemplateOutlet]="toastContent()"
					[ngTemplateOutletContext]="{ $implicit: toast, dismiss: dismissFn }"
				/>
			</hdl-toast>
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlToastContainer {
	readonly toastService = inject(HdlToastService);
	readonly toastContent = input.required<TemplateRef<HdlToastContext>>();

	readonly dismissFn = (id: string): void => {
		this.toastService.dismiss(id);
	};
}
