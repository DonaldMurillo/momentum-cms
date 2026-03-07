import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Dashboard footer — registered via provideAdminSlot('dashboard:after', ...).
 * Renders below the dashboard content.
 */
@Component({
	selector: 'test-dashboard-footer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			data-testid="dashboard-footer"
			class="mt-4 rounded-lg bg-warning/10 border border-warning p-4"
		>
			<p class="text-sm font-medium text-warning">Provider Slot: dashboard:after footer</p>
		</div>
	`,
})
export class DashboardFooterComponent {}
