import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Nav start widget — registered via config admin.components.beforeNavigation slot.
 * Renders in the sidebar navigation, after the Dashboard link.
 */
@Component({
	selector: 'test-nav-start-widget',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="nav-start-widget" class="mx-2 my-1 rounded bg-accent p-2">
			<p class="text-xs font-medium text-accent-foreground">Config Slot: beforeNavigation</p>
		</div>
	`,
})
export class NavStartWidgetComponent {}
