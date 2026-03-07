import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * List before filter — registered via per-collection config (articles.admin.components.beforeList).
 * Renders above the articles collection list.
 */
@Component({
	selector: 'test-list-before-filter',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			data-testid="list-before-filter"
			class="mb-4 rounded-lg bg-warning/10 border border-warning p-3"
		>
			<p class="text-sm font-medium text-warning">
				Per-Collection Config Slot: beforeList (articles)
			</p>
		</div>
	`,
})
export class ListBeforeFilterComponent {}
