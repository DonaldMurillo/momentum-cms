/**
 * Form schema types for the standalone form builder.
 *
 * These types define the JSON schema that drives form rendering.
 * No CMS-specific concepts - any Angular 21+ app can use this.
 */

/**
 * Supported field types.
 */
export type FormFieldType =
	| 'text'
	| 'textarea'
	| 'number'
	| 'email'
	| 'select'
	| 'checkbox'
	| 'radio'
	| 'date'
	| 'hidden';

/**
 * Option for select and radio fields.
 */
export interface FormFieldOption {
	label: string;
	value: string | number;
}

/**
 * Condition for showing/hiding a field based on another field's value.
 */
export interface FormCondition {
	/** The name of the field to evaluate. */
	field: string;
	/** Comparison operator. */
	operator: 'equals' | 'not_equals' | 'contains' | 'not_empty' | 'empty';
	/** Value to compare against (for equals/not_equals/contains). */
	value?: unknown;
}

/**
 * Width option for responsive field layout.
 */
export type FormFieldWidth = 'full' | 'half' | 'third';

/**
 * Configuration for a single form field.
 */
export interface FormFieldConfig {
	/** Unique field name (used as form control key). */
	name: string;
	/** Field type determines which renderer component is used. */
	type: FormFieldType;
	/** Display label. */
	label?: string;
	/** Placeholder text for text-like inputs. */
	placeholder?: string;
	/** Whether the field is required. */
	required?: boolean;
	/** Default value when the form initializes. */
	defaultValue?: unknown;
	/** Whether the field is disabled. */
	disabled?: boolean;
	/** Pattern validation for text fields. */
	validation?: {
		pattern?: string;
		patternMessage?: string;
	};
	/** Conditions that determine field visibility. */
	conditions?: FormCondition[];
	/** Options for select/radio fields. */
	options?: FormFieldOption[];
	/** Number of visible rows (textarea). */
	rows?: number;
	/** Minimum value (number). */
	min?: number;
	/** Maximum value (number). */
	max?: number;
	/** Step increment (number). */
	step?: number;
	/** Minimum text length (text/textarea/email). */
	minLength?: number;
	/** Maximum text length (text/textarea/email). */
	maxLength?: number;
	/** Layout width hint. */
	width?: FormFieldWidth;
}

/**
 * A step in a multi-step form wizard.
 */
export interface FormStep {
	/** Unique step identifier. */
	id: string;
	/** Display label for the step. */
	label: string;
	/** Field names included in this step. */
	fields: string[];
}

/**
 * Form-level settings.
 */
export interface FormSettings {
	/** Label for the submit button. */
	submitLabel?: string;
	/** Message shown on successful submission. */
	successMessage?: string;
	/** Whether to show a reset button. */
	showReset?: boolean;
	/** Label for the reset button. */
	resetLabel?: string;
}

/**
 * The root schema that drives form rendering.
 */
export interface FormSchema {
	/** Unique identifier for the form. */
	id: string;
	/** Form title (rendered as heading). */
	title?: string;
	/** Description displayed below the title. */
	description?: string;
	/** Field configurations. */
	fields: FormFieldConfig[];
	/** Multi-step wizard configuration. */
	steps?: FormStep[];
	/** Form-level settings. */
	settings?: FormSettings;
}
