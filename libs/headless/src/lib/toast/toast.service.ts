import { inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import type { Toast, ToastConfig, ToastPosition } from './toast.types';

let toastIdCounter = 0;

@Injectable({ providedIn: 'root' })
export class HdlToastService {
	private readonly document = inject(DOCUMENT);
	private readonly liveAnnouncer = inject(LiveAnnouncer);

	readonly position = signal<ToastPosition>('bottom-right');
	readonly maxToasts = signal(5);
	readonly toasts = signal<Toast[]>([]);

	show(title: string, description?: string, config?: ToastConfig): string {
		const id = `hdl-toast-${toastIdCounter++}`;

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

		this.toasts.update((toasts) => {
			const newToasts = [...toasts, toast];
			if (newToasts.length > this.maxToasts()) {
				return newToasts.slice(-this.maxToasts());
			}
			return newToasts;
		});

		const announcement = description ? `${title}. ${description}` : title;
		const politeness = toast.variant === 'destructive' ? 'assertive' : 'polite';
		void this.liveAnnouncer.announce(announcement, politeness);

		if (toast.duration > 0) {
			this.document.defaultView?.setTimeout(() => {
				this.dismiss(id);
			}, toast.duration);
		}

		return id;
	}

	success(title: string, description?: string): string {
		return this.show(title, description, { variant: 'success' });
	}

	error(title: string, description?: string): string {
		return this.show(title, description, { variant: 'destructive' });
	}

	warning(title: string, description?: string): string {
		return this.show(title, description, { variant: 'warning' });
	}

	dismiss(id: string): void {
		this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
	}

	dismissAll(): void {
		this.toasts.set([]);
	}

	setPosition(position: ToastPosition): void {
		this.position.set(position);
	}

	setMaxToasts(max: number): void {
		this.maxToasts.set(max);
	}
}
