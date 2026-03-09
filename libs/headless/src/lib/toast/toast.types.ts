export type ToastVariant = 'default' | 'success' | 'destructive' | 'warning';
export type ToastPosition =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right';

export interface Toast {
	id: string;
	title: string;
	description?: string;
	variant: ToastVariant;
	duration: number;
	action?: ToastAction;
	dismissible: boolean;
	createdAt: number;
}

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface ToastConfig {
	variant?: ToastVariant;
	duration?: number;
	action?: ToastAction;
	dismissible?: boolean;
}
