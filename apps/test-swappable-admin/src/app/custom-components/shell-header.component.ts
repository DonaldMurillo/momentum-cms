import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Shell header — registered via provideAdminSlot('shell:header', ...).
 * Renders at the top of the main content area, above the router outlet.
 */
@Component({
	selector: 'test-shell-header',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			data-testid="shell-header"
			class="mb-4 rounded-lg bg-destructive/10 border border-destructive p-3"
		>
			<p class="text-sm font-medium text-destructive">Provider Slot: shell:header</p>
		</div>
	`,
})
export class ShellHeaderComponent {}
