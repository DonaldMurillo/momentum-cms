import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Shell footer — registered via config admin.components.footer slot.
 * Renders at the bottom of the main content area.
 */
@Component({
	selector: 'test-shell-footer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="shell-footer" class="mt-4 rounded-lg bg-muted border border-border p-3">
			<p class="text-sm text-muted-foreground">Config Slot: footer (shell:footer)</p>
		</div>
	`,
})
export class ShellFooterComponent {}
