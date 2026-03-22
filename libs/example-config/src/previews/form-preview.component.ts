import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LivePreviewService } from '@momentumcms/admin/live-preview';
import { FormBuilderComponent, type FormSchema } from '@momentumcms/form-builder';

/**
 * Live preview wrapper for Forms.
 *
 * Renders the actual FormBuilderComponent with the current schema
 * from LivePreviewService. Submission is a no-op in preview mode.
 */
@Component({
	selector: 'mcms-form-live-preview',
	imports: [FormBuilderComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block p-4' },
	template: `
		@if (previewSchema(); as schema) {
			@if (schema.fields.length > 0) {
				<mcms-form-builder [schema]="schema" (formSubmit)="noop()" />
			} @else {
				<div class="flex items-center justify-center py-12 text-sm text-muted-foreground">
					Add fields to see a live preview
				</div>
			}
		} @else {
			<div class="flex items-center justify-center py-12 text-sm text-muted-foreground">
				No form schema defined
			</div>
		}
	`,
})
export class FormPreviewComponent {
	private readonly livePreview = inject(LivePreviewService);

	/* eslint-disable @typescript-eslint/consistent-type-assertions -- documentData() is Record<string, unknown>, narrowing requires casts */
	readonly previewSchema = computed((): FormSchema | null => {
		const data = this.livePreview.documentData();
		const schema = data['schema'];
		if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null;
		const obj = schema as Record<string, unknown>;
		if (!Array.isArray(obj['fields'])) return null;
		return {
			...(obj as unknown as FormSchema),
			id: String(obj['id'] ?? 'preview'),
		};
	});
	/* eslint-enable @typescript-eslint/consistent-type-assertions */

	/** No-op: form submission is disabled in preview mode. */
	noop(): void {
		// intentionally empty
	}
}
