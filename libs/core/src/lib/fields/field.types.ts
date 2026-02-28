/**
 * Field Types for Momentum CMS
 * Defines all available field types and their configurations
 */

// Base field options shared by all fields
export interface BaseFieldOptions {
	required?: boolean;
	unique?: boolean;
	defaultValue?: unknown;
	label?: string;
	description?: string;
	admin?: FieldAdminConfig;
	access?: FieldAccessConfig;
	hooks?: FieldHooksConfig;
	validate?: ValidateFunction;
}

// Field admin panel configuration
export interface FieldAdminConfig {
	position?: 'sidebar' | 'main';
	width?: 'full' | 'half' | 'third';
	condition?: (data: Record<string, unknown>) => boolean;
	readOnly?: boolean;
	hidden?: boolean;
	placeholder?: string;
	/** Editor rendering mode. 'visual' enables WYSIWYG block editor; 'email-builder' enables email template builder; 'form-builder' enables form schema builder for json fields. */
	editor?: 'visual' | 'form' | 'email-builder' | 'form-builder';
	/** Render this group field as a collapsible accordion section */
	collapsible?: boolean;
	/** Whether the collapsible section starts expanded (default: false) */
	defaultOpen?: boolean;
}

// Field-level access control
export interface FieldAccessConfig {
	create?: FieldAccessFunction;
	read?: FieldAccessFunction;
	update?: FieldAccessFunction;
}

export type FieldAccessFunction = (args: {
	req: unknown;
	data?: Record<string, unknown>;
	doc?: Record<string, unknown>;
}) => boolean | Promise<boolean>;

// Field-level hooks
export interface FieldHooksConfig {
	beforeValidate?: FieldHookFunction[];
	beforeChange?: FieldHookFunction[];
	afterChange?: FieldHookFunction[];
	afterRead?: FieldHookFunction[];
}

export type FieldHookFunction = (args: {
	value: unknown;
	data: Record<string, unknown>;
	req: unknown;
	operation: 'create' | 'update' | 'read';
}) => unknown | Promise<unknown>;

// Validation function type
export type ValidateFunction = (
	value: unknown,
	args: { data: Record<string, unknown>; req: unknown },
) => string | true | Promise<string | true>;

// ============================================
// Display Format Types
// ============================================

/** Display format configuration for number fields. Maps to Intl.NumberFormat options. */
export interface NumberDisplayFormat {
	/** Formatting style: 'currency' for prices, 'percent' for percentages, 'decimal' for plain numbers */
	style?: 'decimal' | 'currency' | 'percent';
	/** ISO 4217 currency code (e.g. 'USD', 'EUR'). Required when style is 'currency'. */
	currency?: string;
	/** BCP 47 locale tag (e.g. 'en-US'). Defaults to browser locale. */
	locale?: string;
	/** Minimum number of fraction digits to display */
	minimumFractionDigits?: number;
	/** Maximum number of fraction digits to display */
	maximumFractionDigits?: number;
}

/** Preset date/time format styles, mapping to Intl.DateTimeFormat dateStyle/timeStyle */
export type DateDisplayPreset = 'short' | 'medium' | 'long' | 'full';

/** Display format configuration for date fields. Maps to Intl.DateTimeFormat options. */
export interface DateDisplayFormat {
	/** Preset format style (maps to Intl.DateTimeFormat dateStyle) */
	preset?: DateDisplayPreset;
	/** BCP 47 locale tag. Defaults to browser locale. */
	locale?: string;
	/** Whether to include time in the display. Defaults to false. */
	includeTime?: boolean;
	/** Time style when includeTime is true (maps to Intl.DateTimeFormat timeStyle) */
	timePreset?: DateDisplayPreset;
}

// ============================================
// Field Type Definitions
// ============================================

export type FieldType =
	| 'text'
	| 'textarea'
	| 'richText'
	| 'number'
	| 'date'
	| 'checkbox'
	| 'select'
	| 'radio'
	| 'email'
	| 'password'
	| 'upload'
	| 'relationship'
	| 'array'
	| 'group'
	| 'blocks'
	| 'json'
	| 'point'
	| 'slug'
	| 'tabs'
	| 'collapsible'
	| 'row';

/** Layout field types that organize form fields visually but don't store data */
export const LAYOUT_FIELD_TYPES: ReadonlySet<FieldType> = new Set(['tabs', 'collapsible', 'row']);

// Base field interface
export interface BaseField {
	name: string;
	type: FieldType;
	required?: boolean;
	unique?: boolean;
	defaultValue?: unknown;
	label?: string;
	description?: string;
	admin?: FieldAdminConfig;
	access?: FieldAccessConfig;
	hooks?: FieldHooksConfig;
	validate?: ValidateFunction;
}

// Text field
export interface TextField extends BaseField {
	type: 'text';
	minLength?: number;
	maxLength?: number;
}

// Textarea field
export interface TextareaField extends BaseField {
	type: 'textarea';
	minLength?: number;
	maxLength?: number;
	rows?: number;
}

// Rich text field
export interface RichTextField extends BaseField {
	type: 'richText';
	// Rich text editor specific options
}

// Number field
export interface NumberField extends BaseField {
	type: 'number';
	min?: number;
	max?: number;
	step?: number;
	/** Display format for read-only views (e.g. currency, percent) */
	displayFormat?: NumberDisplayFormat;
}

// Date field
export interface DateField extends BaseField {
	type: 'date';
	/** Display format for read-only views (e.g. preset style, locale) */
	displayFormat?: DateDisplayFormat;
}

// Checkbox field
export interface CheckboxField extends BaseField {
	type: 'checkbox';
}

// Select option
export interface SelectOption {
	label: string;
	value: string | number;
}

// Select field
export interface SelectField extends BaseField {
	type: 'select';
	options: SelectOption[];
	hasMany?: boolean;
}

// Radio field
export interface RadioField extends BaseField {
	type: 'radio';
	options: SelectOption[];
}

// Email field
export interface EmailField extends BaseField {
	type: 'email';
}

// Password field
export interface PasswordField extends BaseField {
	type: 'password';
	minLength?: number;
}

// Upload field
export interface UploadField extends BaseField {
	type: 'upload';
	/** Collection slug where media documents are stored (default: 'media') */
	relationTo: string;
	/** Allowed MIME types (e.g., ['image/*', 'application/pdf']) */
	mimeTypes?: string[];
	/** Maximum file size in bytes */
	maxSize?: number;
	/** Allow multiple file uploads */
	hasMany?: boolean;
}

/** Behavior when a referenced document is deleted. Maps to SQL FK constraint. */
export type OnDeleteAction = 'set-null' | 'restrict' | 'cascade';

/**
 * Error thrown when a delete or update violates a foreign key constraint.
 * Lives in core because it represents a domain-level referential integrity violation,
 * not an HTTP concern. Mapped to HTTP 409 by server-core's handleError.
 */
export class ReferentialIntegrityError extends Error {
	readonly constraint: string;
	readonly table: string;

	constructor(table: string, constraint: string) {
		super(`Cannot delete from "${table}": referenced by foreign key constraint "${constraint}"`);
		this.name = 'ReferentialIntegrityError';
		this.table = table;
		this.constraint = constraint;
	}
}

// Relationship field - uses lazy reference to avoid circular imports
export interface RelationshipField extends BaseField {
	type: 'relationship';
	/** Single target collection (lazy reference to avoid circular imports) */
	collection: () => unknown; // Lazy reference to CollectionConfig
	/** Multiple target collections for polymorphic relationships */
	relationTo?: Array<() => unknown>;
	hasMany?: boolean;
	/**
	 * Behavior when the referenced document is deleted.
	 * Maps to SQL FK constraint: 'set-null' → ON DELETE SET NULL, etc.
	 * Only applies to single-value relationships (not hasMany or polymorphic).
	 * @default 'set-null'
	 */
	onDelete?: OnDeleteAction;
	/** Filter which related documents can be selected */
	filterOptions?: (args: { data: Record<string, unknown> }) => Record<string, unknown>;
}

/** Value shape for polymorphic relationships (when relationTo is set) */
export interface PolymorphicRelationshipValue {
	relationTo: string;
	value: string;
}

// Array field
export interface ArrayField extends BaseField {
	type: 'array';
	fields: Field[];
	minRows?: number;
	maxRows?: number;
	/** Name of the sub-field to use as summary label in read-only views. Falls back to first text sub-field. */
	displayField?: string;
}

// Group field
export interface GroupField extends BaseField {
	type: 'group';
	fields: Field[];
}

/** Editor configuration for a block type in the visual block editor */
export interface BlockEditorConfig {
	/** Custom Angular component for visual rendering in the editor */
	component?: unknown;
	/** Which fields should be inline-editable (defaults to auto-detect text/textarea/richText) */
	inlineFields?: string[];
}

// Block definition for blocks field
export interface BlockConfig {
	slug: string;
	fields: Field[];
	labels?: {
		singular?: string;
		plural?: string;
	};
	/** Visual editor customization for this block type */
	editor?: BlockEditorConfig;
}

// Blocks field
export interface BlocksField extends BaseField {
	type: 'blocks';
	blocks: BlockConfig[];
	minRows?: number;
	maxRows?: number;
}

// JSON field
export interface JSONField extends BaseField {
	type: 'json';
}

// Point field (for geolocation)
export interface PointField extends BaseField {
	type: 'point';
}

// Slug field
export interface SlugField extends BaseField {
	type: 'slug';
	from: string; // Field to generate slug from
}

// ============================================
// Layout Fields (visual organization, no data storage)
// ============================================

/** Tab definition within a tabs layout field */
export interface TabConfig {
	/** When present, creates a nested data structure (like a group). Omit for layout-only tabs. */
	name?: string;
	label: string;
	description?: string;
	fields: Field[];
}

/** Type guard: returns true if the tab has a non-empty name (stores nested data). */
export function isNamedTab(tab: TabConfig): tab is TabConfig & { name: string } {
	return typeof tab.name === 'string' && tab.name.length > 0;
}

/** Tabs layout field - organizes fields into tabbed sections */
export interface TabsField extends BaseField {
	type: 'tabs';
	tabs: TabConfig[];
}

/** Collapsible layout field - wraps fields in an expandable section */
export interface CollapsibleField extends BaseField {
	type: 'collapsible';
	fields: Field[];
	/** Whether the section starts expanded (default: false) */
	defaultOpen?: boolean;
}

/** Row layout field - displays child fields in a horizontal row */
export interface RowField extends BaseField {
	type: 'row';
	fields: Field[];
}

// Union type of all fields
export type Field =
	| TextField
	| TextareaField
	| RichTextField
	| NumberField
	| DateField
	| CheckboxField
	| SelectField
	| RadioField
	| EmailField
	| PasswordField
	| UploadField
	| RelationshipField
	| ArrayField
	| GroupField
	| BlocksField
	| JSONField
	| PointField
	| SlugField
	| TabsField
	| CollapsibleField
	| RowField;

/** Check if a field type is a layout type (no data storage) */
export function isLayoutField(field: Field): field is TabsField | CollapsibleField | RowField {
	return LAYOUT_FIELD_TYPES.has(field.type);
}

/**
 * Extracts all data fields from a field list, flattening through layout fields.
 * Layout fields (tabs, collapsible, row) are containers that don't store data;
 * their child data fields are stored at the same level as sibling fields.
 */
export function flattenDataFields(fields: Field[]): Field[] {
	const result: Field[] = [];
	for (const field of fields) {
		if (field.type === 'tabs') {
			for (const tab of field.tabs) {
				if (isNamedTab(tab)) {
					// Named tab → synthetic GroupField (nested data, like a group)
					const syntheticGroup: GroupField = {
						name: tab.name,
						type: 'group',
						label: tab.label,
						description: tab.description,
						fields: tab.fields,
					};
					result.push(syntheticGroup);
				} else {
					// Unnamed tab → hoist children to parent level (layout-only)
					result.push(...flattenDataFields(tab.fields));
				}
			}
		} else if (field.type === 'collapsible' || field.type === 'row') {
			result.push(...flattenDataFields(field.fields));
		} else {
			result.push(field);
		}
	}
	return result;
}
