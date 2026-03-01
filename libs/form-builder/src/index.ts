// Types
export type {
	FormSchema,
	FormFieldConfig,
	FormFieldType,
	FormFieldOption,
	FormCondition,
	FormStep,
	FormSettings,
	FormFieldWidth,
} from './lib/types/form-schema.types';
export type { FormSubmitEvent, FormStepChangeEvent } from './lib/types/form-events.types';

// Validation (also available via @momentumcms/form-builder/validation)
export { validateField, validateForm, isUnsafePattern } from './lib/validation/form-validators';
export type { FormValidationError } from './lib/validation/form-validators';

// Schema utilities
export { evaluateConditions } from './lib/schema/condition-evaluator';
export {
	buildInitialModel,
	createFormFromSchema,
	applyFormFieldValidators,
} from './lib/schema/schema-to-signal-form';
export type { FormBuilderForm } from './lib/schema/schema-to-signal-form';

// Components
export { FormBuilderComponent } from './lib/components/form-builder.component';
export { FormFieldHostComponent } from './lib/components/field-renderers/form-field-host.component';

// Services
export { FormFieldRegistry } from './lib/services/form-field-registry.service';

// Providers
export { provideMomentumFormBuilder, provideFormFieldRenderer } from './lib/providers';

// Admin field renderer
export { FormSchemaFieldRendererComponent } from './lib/admin/form-schema-field-renderer.component';
export { FormSubmissionsPageComponent } from './lib/admin/form-submissions-page.component';
