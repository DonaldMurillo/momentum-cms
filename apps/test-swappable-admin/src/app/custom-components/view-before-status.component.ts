import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * View before status — registered via per-collection config (articles.admin.components.beforeView).
 * Renders above the articles view page.
 */
@Component({
	selector: 'test-view-before-status',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			data-testid="view-before-status"
			class="mb-4 rounded-lg bg-success/10 border border-success p-3"
		>
			<p class="text-sm font-medium text-success">
				Per-Collection Config Slot: beforeView (articles)
			</p>
		</div>
	`,
})
export class ViewBeforeStatusComponent {}
