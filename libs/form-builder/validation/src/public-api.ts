/**
 * Secondary entry point for `@momentumcms/form-builder/validation`.
 *
 * Pure validation functions with zero Angular dependencies.
 * Safe to import in both browser and Node.js environments.
 */
export {
	validateField,
	validateForm,
	isUnsafePattern,
	evaluateConditions,
} from '@momentumcms/form-builder';

export type {
	FormValidationError,
	FormFieldConfig,
	FormCondition,
} from '@momentumcms/form-builder';
