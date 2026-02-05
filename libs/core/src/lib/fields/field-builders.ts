/**
 * Field Builder Functions for Momentum CMS
 *
 * These functions provide a clean API for defining collection fields.
 * Example:
 *   fields: [
 *     text('title', { required: true }),
 *     richText('content'),
 *     relationship('author', { collection: () => Users }),
 *   ]
 */

import type {
	TextField,
	TextareaField,
	RichTextField,
	NumberField,
	DateField,
	CheckboxField,
	SelectField,
	RadioField,
	EmailField,
	PasswordField,
	UploadField,
	RelationshipField,
	ArrayField,
	GroupField,
	BlocksField,
	JSONField,
	PointField,
	SlugField,
	TabsField,
	CollapsibleField,
	RowField,
	SelectOption,
	BlockConfig,
	TabConfig,
	Field,
	BaseFieldOptions,
} from './field.types';

// ============================================
// Text Fields
// ============================================

export interface TextFieldOptions extends BaseFieldOptions {
	minLength?: number;
	maxLength?: number;
}

export function text(name: string, options: TextFieldOptions = {}): TextField {
	return {
		name,
		type: 'text',
		...options,
	};
}

export interface TextareaFieldOptions extends BaseFieldOptions {
	minLength?: number;
	maxLength?: number;
	rows?: number;
}

export function textarea(name: string, options: TextareaFieldOptions = {}): TextareaField {
	return {
		name,
		type: 'textarea',
		...options,
	};
}

// ============================================
// Rich Text
// ============================================

export type RichTextFieldOptions = BaseFieldOptions;

export function richText(name: string, options: RichTextFieldOptions = {}): RichTextField {
	return {
		name,
		type: 'richText',
		...options,
	};
}

// ============================================
// Number
// ============================================

export interface NumberFieldOptions extends BaseFieldOptions {
	min?: number;
	max?: number;
	step?: number;
}

export function number(name: string, options: NumberFieldOptions = {}): NumberField {
	return {
		name,
		type: 'number',
		...options,
	};
}

// ============================================
// Date
// ============================================

export type DateFieldOptions = BaseFieldOptions;

export function date(name: string, options: DateFieldOptions = {}): DateField {
	return {
		name,
		type: 'date',
		...options,
	};
}

// ============================================
// Checkbox
// ============================================

export type CheckboxFieldOptions = BaseFieldOptions;

export function checkbox(name: string, options: CheckboxFieldOptions = {}): CheckboxField {
	return {
		name,
		type: 'checkbox',
		...options,
		defaultValue: options.defaultValue ?? false,
	};
}

// ============================================
// Select & Radio
// ============================================

export interface SelectFieldOptions extends BaseFieldOptions {
	options: SelectOption[];
	hasMany?: boolean;
}

export function select(name: string, options: SelectFieldOptions): SelectField {
	return {
		name,
		type: 'select',
		...options,
	};
}

export interface RadioFieldOptions extends BaseFieldOptions {
	options: SelectOption[];
}

export function radio(name: string, options: RadioFieldOptions): RadioField {
	return {
		name,
		type: 'radio',
		...options,
	};
}

// ============================================
// Email & Password
// ============================================

export type EmailFieldOptions = BaseFieldOptions;

export function email(name: string, options: EmailFieldOptions = {}): EmailField {
	return {
		name,
		type: 'email',
		...options,
	};
}

export interface PasswordFieldOptions extends BaseFieldOptions {
	minLength?: number;
}

export function password(name: string, options: PasswordFieldOptions = {}): PasswordField {
	return {
		name,
		type: 'password',
		...options,
	};
}

// ============================================
// Upload
// ============================================

export interface UploadFieldOptions extends BaseFieldOptions {
	/** Collection slug where media documents are stored (default: 'media') */
	relationTo?: string;
	/** Allowed MIME types (e.g., ['image/*', 'application/pdf']) */
	mimeTypes?: string[];
	/** Maximum file size in bytes */
	maxSize?: number;
	/** Allow multiple file uploads */
	hasMany?: boolean;
}

export function upload(name: string, options: UploadFieldOptions = {}): UploadField {
	return {
		name,
		type: 'upload',
		relationTo: options.relationTo ?? 'media',
		...options,
	};
}

// ============================================
// Relationship
// ============================================

export interface RelationshipFieldOptions extends BaseFieldOptions {
	collection: () => unknown; // Lazy reference to avoid circular imports
	hasMany?: boolean;
}

export function relationship(name: string, options: RelationshipFieldOptions): RelationshipField {
	return {
		name,
		type: 'relationship',
		...options,
	};
}

// ============================================
// Array
// ============================================

export interface ArrayFieldOptions extends BaseFieldOptions {
	fields: Field[];
	minRows?: number;
	maxRows?: number;
}

export function array(name: string, options: ArrayFieldOptions): ArrayField {
	return {
		name,
		type: 'array',
		...options,
	};
}

// ============================================
// Group
// ============================================

export interface GroupFieldOptions extends BaseFieldOptions {
	fields: Field[];
}

export function group(name: string, options: GroupFieldOptions): GroupField {
	return {
		name,
		type: 'group',
		...options,
	};
}

// ============================================
// Blocks
// ============================================

export interface BlocksFieldOptions extends BaseFieldOptions {
	blocks: BlockConfig[];
	minRows?: number;
	maxRows?: number;
}

export function blocks(name: string, options: BlocksFieldOptions): BlocksField {
	return {
		name,
		type: 'blocks',
		...options,
	};
}

// ============================================
// JSON
// ============================================

export type JSONFieldOptions = BaseFieldOptions;

export function json(name: string, options: JSONFieldOptions = {}): JSONField {
	return {
		name,
		type: 'json',
		...options,
	};
}

// ============================================
// Point (Geolocation)
// ============================================

export type PointFieldOptions = BaseFieldOptions;

export function point(name: string, options: PointFieldOptions = {}): PointField {
	return {
		name,
		type: 'point',
		...options,
	};
}

// ============================================
// Slug
// ============================================

export interface SlugFieldOptions extends BaseFieldOptions {
	from: string; // Field to generate slug from
}

export function slug(name: string, options: SlugFieldOptions): SlugField {
	return {
		name,
		type: 'slug',
		...options,
	};
}

// ============================================
// Layout Fields (visual organization, no data storage)
// ============================================

export interface TabsFieldOptions {
	tabs: TabConfig[];
	label?: string;
	description?: string;
}

/** Organizes fields into tabbed sections. Does not store data. */
export function tabs(name: string, options: TabsFieldOptions): TabsField {
	return {
		name,
		type: 'tabs',
		...options,
	};
}

export interface CollapsibleFieldOptions {
	fields: Field[];
	label?: string;
	description?: string;
	/** Whether the section starts expanded (default: false) */
	defaultOpen?: boolean;
}

/** Wraps fields in a collapsible/expandable section. Does not store data. */
export function collapsible(name: string, options: CollapsibleFieldOptions): CollapsibleField {
	return {
		name,
		type: 'collapsible',
		...options,
	};
}

export interface RowFieldOptions {
	fields: Field[];
	label?: string;
	description?: string;
}

/** Displays child fields in a horizontal row layout. Does not store data. */
export function row(name: string, options: RowFieldOptions): RowField {
	return {
		name,
		type: 'row',
		...options,
	};
}
