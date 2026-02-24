/**
 * Universal types for @momentumcms/email.
 * Safe to import from both browser and server code.
 *
 * Import via: `import { EmailBlock, ... } from '@momentumcms/email/types';`
 */

/**
 * A single block in an email template.
 */
export interface EmailBlock {
	/** Block type identifier (e.g., 'header', 'text', 'button') */
	type: string;
	/** Block-specific configuration data */
	data: Record<string, unknown>;
	/** Unique block identifier */
	id: string;
}

/**
 * Field definition for block configuration in the builder.
 */
export interface EmailBlockField {
	/** Field name (key in block data) */
	name: string;
	/** Display label */
	label: string;
	/** Field type for the builder UI */
	type: 'text' | 'textarea' | 'number' | 'color' | 'select' | 'url' | 'toggle' | 'blocks';
	/** Default value */
	defaultValue?: unknown;
	/** Whether this field is required */
	required?: boolean;
	/** Options for select fields */
	options?: { label: string; value: string }[];
}

/**
 * Definition of an email block type (used by both builder and renderer).
 */
export interface EmailBlockDefinition {
	/** Unique block type slug */
	slug: string;
	/** Human-readable label */
	label: string;
	/** Icon identifier */
	icon?: string;
	/** Configurable fields shown in the builder */
	fields: EmailBlockField[];
	/** Default data when a new block of this type is created */
	defaultData: Record<string, unknown>;
}

/**
 * A complete email template (blocks + theme).
 */
export interface EmailTemplate {
	/** Ordered array of email blocks */
	blocks: EmailBlock[];
	/** Optional theme overrides */
	theme?: EmailTheme;
}

/**
 * Theme configuration for email rendering.
 */
export interface EmailTheme {
	/** Primary brand color (used for buttons, links) */
	primaryColor: string;
	/** Email background color */
	backgroundColor: string;
	/** Primary text color */
	textColor: string;
	/** Muted/secondary text color */
	mutedColor: string;
	/** Font family stack */
	fontFamily: string;
	/** Card/container border radius */
	borderRadius: string;
}

/**
 * Default email theme matching Momentum CMS styling.
 */
export const DEFAULT_EMAIL_THEME: EmailTheme = {
	primaryColor: '#18181b',
	backgroundColor: '#f4f4f5',
	textColor: '#3f3f46',
	mutedColor: '#71717a',
	fontFamily:
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
	borderRadius: '8px',
};
