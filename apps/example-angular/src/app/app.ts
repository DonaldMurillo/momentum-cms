import { Component, ChangeDetectionStrategy, afterNextRender } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
	imports: [RouterModule],
	selector: 'app-root',
	templateUrl: './app.html',
	styleUrl: './app.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
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
