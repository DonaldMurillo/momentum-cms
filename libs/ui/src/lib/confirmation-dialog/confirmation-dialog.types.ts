export type ConfirmationIcon = 'warning' | 'danger' | 'info' | 'question';
export type ConfirmationVariant = 'default' | 'destructive';

/**
 * Configuration for a confirmation dialog.
 */
export interface ConfirmationConfig {
	/** Dialog title. */
	title: string;
	/** Optional description text. */
	description?: string;
	/** Text for the confirm button. Default: 'Confirm' */
	confirmText?: string;
	/** Text for the cancel button. Default: 'Cancel' */
	cancelText?: string;
	/** Button variant for the confirm button. Default: 'default' */
	variant?: ConfirmationVariant;
	/** Optional icon to show. */
	icon?: ConfirmationIcon;
}
