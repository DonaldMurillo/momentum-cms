import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Dashboard banner — registered via config admin.components.beforeDashboard slot.
 * Renders above the dashboard content.
 */
@Component({
	selector: 'test-dashboard-banner',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="dashboard-banner" class="mb-4 rounded-lg bg-info/10 border border-info p-4">
			<p class="text-sm font-medium text-info">Config Slot: beforeDashboard banner</p>
		</div>
	`,
})
export class DashboardBannerComponent {}
