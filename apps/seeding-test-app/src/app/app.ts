import { Component, afterNextRender } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
	imports: [RouterModule],
	selector: 'app-root',
	templateUrl: './app.html',
	styleUrl: './app.css',
})
export class App {
	protected title = 'seeding-test-app';

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
