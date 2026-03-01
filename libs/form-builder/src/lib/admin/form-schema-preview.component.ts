import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormBuilderComponent } from '../components/form-builder.component';
import { FormSchemaEditorStateService } from './form-schema-editor-state.service';
import type { FormSchema } from '../types/form-schema.types';

/**
 * Live preview panel for the form schema editor.
 *
 * Renders the form using FormBuilderComponent with the current editor state.
 * Form submission is a no-op in preview mode.
 */
@Component({
	selector: 'mcms-form-schema-preview',
	imports: [FormBuilderComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (previewSchema(); as schema) {
			@if (schema.fields.length > 0) {
				<mcms-form-builder [schema]="schema" (formSubmit)="onPreviewSubmit()" />
			} @else {
				<div class="flex items-center justify-center py-12 text-sm text-muted-foreground">
					Add fields to see a live preview
				</div>
			}
		}
	`,
})
export class FormSchemaPreviewComponent {
	private readonly editorState = inject(FormSchemaEditorStateService);

	readonly previewSchema = computed((): FormSchema => {
		const schema = this.editorState.schema();
		return {
			...schema,
			id: schema.id || 'preview',
		};
	});

	/** No-op: form submission is disabled in preview mode. */
	onPreviewSubmit(): void {
		// intentionally empty — preview only
	}
}
