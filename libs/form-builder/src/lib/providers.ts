import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders, Type } from '@angular/core';
import { FormFieldRegistry } from './services/form-field-registry.service';

/**
 * Register all built-in form field renderers for the form builder.
 *
 * Call this in your app's `providers` array:
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMomentumFormBuilder(),
 *   ],
 * };
 * ```
 */
export function provideMomentumFormBuilder(): ReturnType<typeof makeEnvironmentProviders> {
	return makeEnvironmentProviders([
		{
			provide: ENVIRONMENT_INITIALIZER,
			multi: true,
			useFactory: (): (() => void) => {
				const registry = inject(FormFieldRegistry);
				return (): void => {
					registry.register('text', () =>
						import('./components/field-renderers/form-text-field.component').then(
							(m) => m.FormTextFieldComponent,
						),
					);

					registry.register('textarea', () =>
						import('./components/field-renderers/form-textarea-field.component').then(
							(m) => m.FormTextareaFieldComponent,
						),
					);

					registry.register('number', () =>
						import('./components/field-renderers/form-number-field.component').then(
							(m) => m.FormNumberFieldComponent,
						),
					);

					registry.register('email', () =>
						import('./components/field-renderers/form-email-field.component').then(
							(m) => m.FormEmailFieldComponent,
						),
					);

					registry.register('select', () =>
						import('./components/field-renderers/form-select-field.component').then(
							(m) => m.FormSelectFieldComponent,
						),
					);

					registry.register('checkbox', () =>
						import('./components/field-renderers/form-checkbox-field.component').then(
							(m) => m.FormCheckboxFieldComponent,
						),
					);

					registry.register('radio', () =>
						import('./components/field-renderers/form-radio-field.component').then(
							(m) => m.FormRadioFieldComponent,
						),
					);

					registry.register('date', () =>
						import('./components/field-renderers/form-date-field.component').then(
							(m) => m.FormDateFieldComponent,
						),
					);

					registry.register('hidden', () =>
						import('./components/field-renderers/form-hidden-field.component').then(
							(m) => m.FormHiddenFieldComponent,
						),
					);
				};
			},
		},
	]);
}

/**
 * Register a custom form field renderer.
 *
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMomentumFormBuilder(),
 *     provideFormFieldRenderer('rating', () =>
 *       import('./renderers/rating-field.component').then(m => m.RatingFieldComponent)
 *     ),
 *   ],
 * };
 * ```
 */
export function provideFormFieldRenderer(
	type: string,
	loader: () => Promise<Type<unknown>>,
): ReturnType<typeof makeEnvironmentProviders> {
	return makeEnvironmentProviders([
		{
			provide: ENVIRONMENT_INITIALIZER,
			multi: true,
			useFactory: (): (() => void) => {
				const registry = inject(FormFieldRegistry);
				return (): void => {
					registry.register(type, loader);
				};
			},
		},
	]);
}
