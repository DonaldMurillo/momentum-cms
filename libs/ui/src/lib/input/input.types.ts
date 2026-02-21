/**
 * Validation error from Signal Forms
 */
export interface ValidationError {
	kind: string;
	message?: string;
	[key: string]: unknown;
}

export type InputType =
	| 'text'
	| 'email'
	| 'password'
	| 'number'
	| 'tel'
	| 'url'
	| 'search'
	| 'date'
	| 'datetime-local';
