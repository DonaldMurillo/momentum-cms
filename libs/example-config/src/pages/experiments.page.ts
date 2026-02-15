/* eslint-disable no-console */
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { injectMomentumAPI } from '@momentum-cms/admin';

@Component({
	selector: 'app-experiments-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<h1>Experiments</h1>
		<p>Check console for API output</p>
	`,
})
export class ExperimentsPage {
	protected api = injectMomentumAPI();

	constructor() {
		this.api
			.collection('users')
			.find()
			.then((result) => {
				console.info('Users:', result.docs);
			});
	}
}
