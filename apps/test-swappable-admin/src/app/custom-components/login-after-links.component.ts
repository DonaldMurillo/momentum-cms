import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Login after links — registered via config admin.components.afterLogin slot.
 * Renders below the login form.
 */
@Component({
	selector: 'test-login-after-links',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="login-after-links" class="mt-4 text-center">
			<p class="text-xs text-muted-foreground">Config Slot: afterLogin</p>
			<p class="text-xs text-muted-foreground mt-1">Need help? Contact your administrator.</p>
		</div>
	`,
})
export class LoginAfterLinksComponent {}
