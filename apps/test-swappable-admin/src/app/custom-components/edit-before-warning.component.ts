import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Edit before warning — registered via per-collection config (articles.admin.components.beforeEdit).
 * Renders above the articles edit form.
 */
@Component({
	selector: 'test-edit-before-warning',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			data-testid="edit-before-warning"
			class="mb-4 rounded-lg bg-warning/10 border border-warning p-3"
		>
			<p class="text-sm font-medium text-warning">
				Per-Collection Config Slot: beforeEdit (articles)
			</p>
		</div>
	`,
})
export class EditBeforeWarningComponent {}
