import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Login before banner — registered via config admin.components.beforeLogin slot.
 * Renders above the login form.
 */
@Component({
	selector: 'test-login-before-banner',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div
			data-testid="login-before-banner"
			class="mb-4 rounded-lg bg-info/10 border border-info p-4"
		>
			<p class="text-sm font-medium text-info">Config Slot: beforeLogin</p>
			<p class="text-xs text-muted-foreground mt-1">Welcome to Swappable Admin Test</p>
		</div>
	`,
})
export class LoginBeforeBannerComponent {}
