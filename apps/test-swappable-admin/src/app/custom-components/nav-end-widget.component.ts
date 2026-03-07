import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Nav end widget — registered via provideAdminSlot('shell:nav-end', ...).
 * Renders in the sidebar navigation, after plugin routes.
 */
@Component({
	selector: 'test-nav-end-widget',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="nav-end-widget" class="mx-2 my-1 rounded bg-accent p-2">
			<p class="text-xs font-medium text-accent-foreground">Provider Slot: shell:nav-end</p>
		</div>
	`,
})
export class NavEndWidgetComponent {}
