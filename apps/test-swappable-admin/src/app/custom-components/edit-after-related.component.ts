import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Edit after related — registered via provideAdminSlot('collection-edit:after', ...).
 * Renders below the edit form on all collections.
 */
@Component({
	selector: 'test-edit-after-related',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="edit-after-related" class="mt-4 rounded-lg bg-muted border border-border p-4">
			<p class="text-sm text-muted-foreground">Provider Slot: collection-edit:after</p>
		</div>
	`,
})
export class EditAfterRelatedComponent {}
