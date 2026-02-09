import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Toast } from './toast.types';

/**
 * Individual toast component.
 */
@Component({
	selector: 'mcms-toast',
	host: {
		role: 'status',
		'[style.--toast-bg]': 'variantBg()',
		'[style.--toast-border]': 'variantBorder()',
		'[style.--toast-color]': 'variantColor()',
	},
	template: `
		<div class="toast-content">
			<div class="toast-title">{{ toast().title }}</div>
			@if (toast().description) {
				<div class="toast-description">{{ toast().description }}</div>
			}
		</div>
		@if (toast().action) {
			<button class="toast-action" (click)="onAction()">
				{{ toast().action?.label }}
			</button>
		}
		@if (toast().dismissible) {
			<button class="toast-close" (click)="dismiss()" aria-label="Dismiss notification">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		}
	`,
	styles: `
		:host {
			display: flex;
			align-items: flex-start;
			gap: 0.75rem;
			width: 100%;
			padding: 1rem;
			border-radius: 0.5rem;
			border: 1px solid var(--toast-border);
			background-color: var(--toast-bg);
			color: var(--toast-color);
			box-shadow:
				0 10px 15px -3px rgb(0 0 0 / 0.1),
				0 4px 6px -4px rgb(0 0 0 / 0.1);
			animation: toast-slide-in 0.3s ease-out;
			pointer-events: auto;
		}

		@keyframes toast-slide-in {
			from {
				opacity: 0;
				transform: translateX(100%);
			}
			to {
				opacity: 1;
				transform: translateX(0);
			}
		}

		.toast-content {
			flex: 1;
			min-width: 0;
		}

		.toast-title {
			font-weight: 500;
			font-size: 0.875rem;
			line-height: 1.25rem;
		}

		.toast-description {
			margin-top: 0.25rem;
			font-size: 0.875rem;
			line-height: 1.25rem;
			opacity: 0.9;
		}

		.toast-action {
			flex-shrink: 0;
			padding: 0.25rem 0.75rem;
			font-size: 0.75rem;
			font-weight: 500;
			border-radius: 0.25rem;
			border: 1px solid currentColor;
			background: transparent;
			color: inherit;
			cursor: pointer;
			opacity: 0.8;
			transition: opacity 0.15s;
		}

		.toast-action:hover {
			opacity: 1;
		}

		.toast-close {
			flex-shrink: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 1.25rem;
			height: 1.25rem;
			border: none;
			background: transparent;
			color: inherit;
			cursor: pointer;
			opacity: 0.5;
			transition: opacity 0.15s;
			padding: 0;
		}

		.toast-close:hover {
			opacity: 1;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastComponent {
	readonly toast = input.required<Toast>();
	readonly dismissed = output<void>();

	readonly variantBg = computed((): string => {
		switch (this.toast().variant) {
			case 'default':
				return 'hsl(var(--mcms-card))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive))';
			case 'success':
				return 'hsl(var(--mcms-success))';
			case 'warning':
				return 'hsl(var(--mcms-warning))';
		}
	});

	readonly variantBorder = computed((): string => {
		switch (this.toast().variant) {
			case 'default':
				return 'hsl(var(--mcms-border))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive))';
			case 'success':
				return 'hsl(var(--mcms-success))';
			case 'warning':
				return 'hsl(var(--mcms-warning))';
		}
	});

	readonly variantColor = computed((): string => {
		switch (this.toast().variant) {
			case 'default':
				return 'hsl(var(--mcms-card-foreground))';
			case 'destructive':
				return 'hsl(var(--mcms-destructive-foreground))';
			case 'success':
				return 'hsl(var(--mcms-success-foreground))';
			case 'warning':
				return 'hsl(var(--mcms-warning-foreground))';
		}
	});

	dismiss(): void {
		this.dismissed.emit();
	}

	onAction(): void {
		const action = this.toast().action;
		if (action) {
			action.onClick();
		}
		this.dismiss();
	}
}
