import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

/**
 * Toast container component.
 * Add this to your app root to enable toast notifications.
 *
 * Usage:
 * ```html
 * <!-- In app.component.html -->
 * <router-outlet />
 * <mcms-toast-container />
 * ```
 */
@Component({
	selector: 'mcms-toast-container',
	imports: [ToastComponent],
	host: {
		'aria-live': 'polite',
		'[class]': 'hostClass()',
	},
	template: `
		@for (toast of toasts(); track toast.id) {
			<mcms-toast [toast]="toast" (dismissed)="onDismiss(toast.id)" />
		}
	`,
	styles: `
		:host {
			position: fixed;
			z-index: 100;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: 1rem;
			max-width: 420px;
			width: 100%;
			pointer-events: none;
		}

		:host.top-right {
			top: 0;
			right: 0;
		}

		:host.top-left {
			top: 0;
			left: 0;
		}

		:host.top-center {
			top: 0;
			left: 50%;
			transform: translateX(-50%);
		}

		:host.bottom-right {
			bottom: 0;
			right: 0;
		}

		:host.bottom-left {
			bottom: 0;
			left: 0;
		}

		:host.bottom-center {
			bottom: 0;
			left: 50%;
			transform: translateX(-50%);
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainer {
	private readonly toastService = inject(ToastService);

	readonly toasts = this.toastService.toasts;
	readonly position = this.toastService.position;

	readonly hostClass = computed(() => this.position());

	onDismiss(id: string): void {
		this.toastService.dismiss(id);
	}
}
