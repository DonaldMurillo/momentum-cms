import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders, Type } from '@angular/core';
import { FieldRendererRegistry } from './field-renderer-registry.service';

/**
 * Register all built-in Momentum CMS field renderers.
 *
 * Call this in your app's `providers` array (e.g., `app.config.ts`):
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMomentumFieldRenderers(),
 *   ],
 * };
 * ```
 */
export function provideMomentumFieldRenderers(): ReturnType<typeof makeEnvironmentProviders> {
	return makeEnvironmentProviders([
		{
			provide: ENVIRONMENT_INITIALIZER,
			multi: true,
			useFactory: (): (() => void) => {
				const registry = inject(FieldRendererRegistry);
				return (): void => {
					// Simple field renderers (all resolve to the same component for similar types)
					const textLoader = (): Promise<Type<unknown>> =>
						import('../widgets/entity-form/field-renderers/text-field.component').then(
							(m) => m.TextFieldRenderer,
						);
					registry.register('text', textLoader);
					registry.register('textarea', textLoader);
					registry.register('email', textLoader);
					registry.register('slug', textLoader);

					registry.register('number', () =>
						import('../widgets/entity-form/field-renderers/number-field.component').then(
							(m) => m.NumberFieldRenderer,
						),
					);

					registry.register('select', () =>
						import('../widgets/entity-form/field-renderers/select-field.component').then(
							(m) => m.SelectFieldRenderer,
						),
					);

					registry.register('checkbox', () =>
						import('../widgets/entity-form/field-renderers/checkbox-field.component').then(
							(m) => m.CheckboxFieldRenderer,
						),
					);

					registry.register('date', () =>
						import('../widgets/entity-form/field-renderers/date-field.component').then(
							(m) => m.DateFieldRenderer,
						),
					);

					registry.register('upload', () =>
						import('../widgets/entity-form/field-renderers/upload-field.component').then(
							(m) => m.UploadFieldRenderer,
						),
					);

					registry.register('richText', () =>
						import('../widgets/entity-form/field-renderers/rich-text-field.component').then(
							(m) => m.RichTextFieldRenderer,
						),
					);

					// Layout field renderers (support nested field rendering)
					registry.register('group', () =>
						import('../widgets/entity-form/field-renderers/group-field.component').then(
							(m) => m.GroupFieldRenderer,
						),
					);

					registry.register('array', () =>
						import('../widgets/entity-form/field-renderers/array-field.component').then(
							(m) => m.ArrayFieldRenderer,
						),
					);

					registry.register('blocks', () =>
						import('../widgets/entity-form/field-renderers/blocks-field.component').then(
							(m) => m.BlocksFieldRenderer,
						),
					);

					// Visual block editor variant (blocks field with admin.editor === 'visual')
					registry.register('blocks-visual', () =>
						import('../widgets/visual-block-editor/visual-block-editor.component').then(
							(m) => m.VisualBlockEditorComponent,
						),
					);

					registry.register('relationship', () =>
						import('../widgets/entity-form/field-renderers/relationship-field.component').then(
							(m) => m.RelationshipFieldRenderer,
						),
					);

					// Layout-only renderers (tabs, collapsible, row)
					registry.register('tabs', () =>
						import('../widgets/entity-form/field-renderers/tabs-field.component').then(
							(m) => m.TabsFieldRenderer,
						),
					);

					registry.register('collapsible', () =>
						import('../widgets/entity-form/field-renderers/collapsible-field.component').then(
							(m) => m.CollapsibleFieldRenderer,
						),
					);

					registry.register('row', () =>
						import('../widgets/entity-form/field-renderers/row-field.component').then(
							(m) => m.RowFieldRenderer,
						),
					);
				};
			},
		},
	]);
}

/**
 * Register a custom field renderer for a specific field type.
 *
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMomentumFieldRenderers(),
 *     provideFieldRenderer('color', () =>
 *       import('./renderers/color-field.component').then(m => m.ColorFieldRenderer)
 *     ),
 *   ],
 * };
 * ```
 */
export function provideFieldRenderer(
	type: string,
	loader: () => Promise<Type<unknown>>,
): ReturnType<typeof makeEnvironmentProviders> {
	return makeEnvironmentProviders([
		{
			provide: ENVIRONMENT_INITIALIZER,
			multi: true,
			useFactory: (): (() => void) => {
				const registry = inject(FieldRendererRegistry);
				return (): void => {
					registry.register(type, loader);
				};
			},
		},
	]);
}
