import { Injectable, signal } from '@angular/core';
import type { Toast, ToastConfig, ToastPosition } from './toast.types';

let toastIdCounter = 0;

/**
 * Service for showing toast notifications.
 *
 * Usage:
 * ```typescript
 * // In your component
 * private toast = inject(ToastService);
 *
 * // Show a toast
 * this.toast.show('Changes saved', 'Your changes have been saved successfully.');
 *
 * // Show with variant
 * this.toast.success('Success!', 'Operation completed.');
 * this.toast.error('Error', 'Something went wrong.');
 * this.toast.warning('Warning', 'Please review your input.');
 *
 * // Show with action
 * this.toast.show('File deleted', 'The file has been removed.', {
 *   action: {
 *     label: 'Undo',
 *     onClick: () => this.undoDelete(),
 *   },
 * });
 * ```
 *
 * Remember to add <mcms-toast-container /> to your app root.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
	/** Current toast position. */
	readonly position = signal<ToastPosition>('bottom-right');

	/** Maximum number of visible toasts. Default: 5 */
	readonly maxToasts = signal(5);

	/** Active toasts. */
	readonly toasts = signal<Toast[]>([]);

	/**
	 * Show a toast notification.
	 * @returns The toast ID for programmatic dismissal.
	 */
	show(title: string, description?: string, config?: ToastConfig): string {
		const id = `toast-${toastIdCounter++}`;

		const toast: Toast = {
			id,
			title,
			description,
			variant: config?.variant ?? 'default',
			duration: config?.duration ?? 5000,
			action: config?.action,
			dismissible: config?.dismissible ?? true,
			createdAt: Date.now(),
		};

		// Add toast, respecting max limit
		this.toasts.update((toasts) => {
			const newToasts = [...toasts, toast];
			if (newToasts.length > this.maxToasts()) {
				return newToasts.slice(-this.maxToasts());
			}
			return newToasts;
		});

		// Schedule auto-dismiss
		if (toast.duration > 0) {
			setTimeout(() => {
				this.dismiss(id);
			}, toast.duration);
		}

		return id;
	}

	/**
	 * Show a success toast.
	 */
	success(title: string, description?: string): string {
		return this.show(title, description, { variant: 'success' });
	}

	/**
	 * Show an error toast.
	 */
	error(title: string, description?: string): string {
		return this.show(title, description, { variant: 'destructive' });
	}

	/**
	 * Show a warning toast.
	 */
	warning(title: string, description?: string): string {
		return this.show(title, description, { variant: 'warning' });
	}

	/**
	 * Dismiss a specific toast by ID.
	 */
	dismiss(id: string): void {
		this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
	}

	/**
	 * Dismiss all toasts.
	 */
	dismissAll(): void {
		this.toasts.set([]);
	}

	/**
	 * Set the toast position.
	 */
	setPosition(position: ToastPosition): void {
		this.position.set(position);
	}

	/**
	 * Set the maximum number of visible toasts.
	 */
	setMaxToasts(max: number): void {
		this.maxToasts.set(max);
	}
}
