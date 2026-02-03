/* eslint-disable no-console */
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { injectTypedMomentumAPI } from '@momentum-cms/admin';
import type { TypedMomentumCollections } from '../../../types/momentum.generated';

@Component({
	selector: 'app-experiments-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<h1>Experiments</h1>
		<p>Check console for API output</p>
	`,
})
export class ExperimentsPage {
	// Type-safe API - use injectTypedMomentumAPI (not injectMomentumAPI)
	protected api = injectTypedMomentumAPI<TypedMomentumCollections>();

	constructor() {
		// Full type safety with TransferState (enabled by default):
		// - 'users' and 'posts' autocomplete as collection names
		// - result.docs is typed as Users[]
		// - where clause fields are type-checked
		// - TransferState automatically caches SSR data (no duplicate HTTP calls)
		this.api.users.find().then((result) => {
			console.info('Users:', result.docs);
		});
	}
}
