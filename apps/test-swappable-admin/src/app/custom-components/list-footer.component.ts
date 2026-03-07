import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * List footer — registered via provideAdminSlot('collection-list:after', ...).
 * Renders after every collection list page.
 */
@Component({
	selector: 'test-list-footer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="list-footer" class="mt-4 rounded-lg bg-muted border border-border p-4">
			<p class="text-sm text-muted-foreground">Provider Slot: collection-list:after</p>
		</div>
	`,
})
export class ListFooterComponent {}
