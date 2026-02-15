import { Component, ChangeDetectionStrategy, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
	selector: 'app-root',
	imports: [RouterOutlet],
	template: ` <router-outlet></router-outlet> `,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
	constructor() {
		afterNextRender(() => {
			void import('@momentum-cms/plugins/analytics/client').then((m) => {
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
