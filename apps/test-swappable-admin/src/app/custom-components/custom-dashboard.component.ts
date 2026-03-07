import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AdminSlotOutlet } from '@momentumcms/admin';

/**
 * Custom dashboard page — registered via provideAdminComponent('dashboard', ...).
 * Replaces the built-in dashboard entirely.
 * Includes slot outlets so dashboard:before and dashboard:after still render.
 */
@Component({
	selector: 'test-custom-dashboard',
	imports: [AdminSlotOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block p-8' },
	template: `
		<mcms-admin-slot slot="dashboard:before" />
		<div data-testid="custom-dashboard" class="rounded-lg border border-primary bg-primary/5 p-8">
			<h1 class="text-2xl font-bold text-primary">Custom Dashboard</h1>
			<p class="mt-2 text-muted-foreground">
				This dashboard was registered via provideAdminComponent provider.
			</p>
		</div>
		<mcms-admin-slot slot="dashboard:after" />
	`,
})
export class CustomDashboardComponent {}
