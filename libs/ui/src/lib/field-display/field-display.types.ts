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
	| 'json'
	| 'html'
	| 'group'
	| 'array-table';

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
 * Metadata about a sub-field for structured display types (group, array-table).
 */
export interface FieldDisplayFieldMeta {
	/** Sub-field name (used to extract values from objects) */
	name: string;
	/** Display label for the sub-field */
	label?: string;
	/** Field type from core (text, number, checkbox, etc.) */
	type: string;
}

/**
 * Number format configuration for the display component.
 * Maps to Intl.NumberFormat options.
 */
export interface FieldDisplayNumberFormat {
	/** Formatting style */
	style?: 'decimal' | 'currency' | 'percent';
	/** ISO 4217 currency code (e.g. 'USD') */
	currency?: string;
	/** BCP 47 locale tag (e.g. 'en-US') */
	locale?: string;
	/** Minimum fraction digits */
	minimumFractionDigits?: number;
	/** Maximum fraction digits */
	maximumFractionDigits?: number;
}

/**
 * Date format configuration for the display component.
 * Maps to Intl.DateTimeFormat options.
 */
export interface FieldDisplayDateFormat {
	/** Preset format style */
	preset?: 'short' | 'medium' | 'long' | 'full';
	/** BCP 47 locale tag */
	locale?: string;
	/** Whether to include time */
	includeTime?: boolean;
	/** Time style when includeTime is true */
	timePreset?: 'short' | 'medium' | 'long' | 'full';
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
