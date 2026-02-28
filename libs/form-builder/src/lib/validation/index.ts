/**
 * Pure validation functions for form fields.
 *
 * Zero Angular dependencies — runs in both browser and Node.
 * Import via `@momentumcms/form-builder/validation`.
 */

export { validateField, validateForm, isUnsafePattern } from './form-validators';
export type { FormValidationError, FormFieldConfig } from './form-validators';
export { evaluateConditions } from '../schema/condition-evaluator';
export type { FormCondition } from '../types/form-schema.types';
