/**
 * Supported display types for FieldDisplay component.
 */
export type FieldDisplayType =
	| 'text'
	| 'number'
	| 'date'
	| 'datetime'
	| 'boolean'
	| 'badge'
	| 'link'
	| 'email'
	| 'list'
	| 'json';

/**
 * Badge variant mapping for field values.
 */
export interface FieldDisplayBadgeConfig {
	/** Map of value to variant */
	variants?: Record<
		string,
		'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
	>;
	/** Default variant if no match found */
	defaultVariant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
}

/**
 * Configuration options for FieldDisplay.
 */
export interface FieldDisplayConfig {
	/** Label for the field */
	label?: string;
	/** Format string for dates (e.g., 'YYYY-MM-DD') */
	format?: string;
	/** Text to show when value is empty/null/undefined */
	emptyText?: string;
	/** Badge configuration for type='badge' */
	badgeConfig?: FieldDisplayBadgeConfig;
	/** Whether to open links in new tab (for link/email types) */
	openInNewTab?: boolean;
	/** Maximum items to show for list type before truncating */
	maxItems?: number;
}
