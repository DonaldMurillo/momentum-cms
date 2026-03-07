import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Custom articles list page — registered via collection config admin.components.list.
 * Replaces the built-in collection list for the 'articles' collection.
 */
@Component({
	selector: 'test-custom-articles-list',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block p-8' },
	template: `
		<div
			data-testid="custom-articles-list"
			class="rounded-lg border border-success bg-success/5 p-8"
		>
			<h1 class="text-2xl font-bold text-success">Custom Articles List</h1>
			<p class="mt-2 text-muted-foreground">
				This list was registered via collection config (admin.components.list).
			</p>
		</div>
	`,
})
export class CustomArticlesListComponent {}
