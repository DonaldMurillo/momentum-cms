export type ToastVariant = 'default' | 'destructive' | 'success' | 'warning';
export type ToastPosition =
	| 'top-right'
	| 'top-left'
	| 'top-center'
	| 'bottom-right'
	| 'bottom-left'
	| 'bottom-center';

/**
 * Configuration options for a toast notification.
 */
export interface ToastConfig {
	/** Variant determines the visual style. Default: 'default' */
	variant?: ToastVariant;
	/** Duration in milliseconds. 0 = persistent. Default: 5000 */
	duration?: number;
	/** Optional action button. */
	action?: {
		label: string;
		onClick: () => void;
	};
	/** Whether the toast can be dismissed manually. Default: true */
	dismissible?: boolean;
}

/**
 * Internal toast data structure.
 */
export interface Toast {
	id: string;
	title: string;
	description?: string;
	variant: ToastVariant;
	duration: number;
	action?: ToastConfig['action'];
	dismissible: boolean;
	createdAt: number;
}
