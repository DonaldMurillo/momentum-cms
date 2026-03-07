import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * View after related — registered via provideAdminSlot('collection-view:after', ...).
 * Renders below the view page on all collections.
 */
@Component({
	selector: 'test-view-after-related',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="view-after-related" class="mt-4 rounded-lg bg-muted border border-border p-4">
			<p class="text-sm text-muted-foreground">Provider Slot: collection-view:after</p>
		</div>
	`,
})
export class ViewAfterRelatedComponent {}
