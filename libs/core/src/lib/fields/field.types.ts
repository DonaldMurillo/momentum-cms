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
	| 'slug';

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
}

// Date field
export interface DateField extends BaseField {
	type: 'date';
	// Date picker options
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
	relationTo: string;
	// Upload specific options
}

// Relationship field - uses lazy reference to avoid circular imports
export interface RelationshipField extends BaseField {
	type: 'relationship';
	collection: () => unknown; // Lazy reference to CollectionConfig
	hasMany?: boolean;
}

// Array field
export interface ArrayField extends BaseField {
	type: 'array';
	fields: Field[];
	minRows?: number;
	maxRows?: number;
}

// Group field
export interface GroupField extends BaseField {
	type: 'group';
	fields: Field[];
}

// Block definition for blocks field
export interface BlockConfig {
	slug: string;
	fields: Field[];
	labels?: {
		singular?: string;
		plural?: string;
	};
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
	| SlugField;
