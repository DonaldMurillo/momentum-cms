import { Component, ChangeDetectionStrategy, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet],
	template: ` <router-outlet /> `,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
	constructor() {
		afterNextRender(() => {
			void import('@momentumcms/plugins-analytics/client').then((m) => {
				m.createTracker({
					endpoint: '/api/analytics/collect',
					trackingRules: true,
					blockTracking: true,
					flushInterval: 1000,
				});
			});
		});
	}
}
