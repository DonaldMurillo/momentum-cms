import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Admin page for viewing form submissions.
 *
 * This is a placeholder — the main forms/submissions CRUD is handled by
 * the built-in collection UI. This page provides an aggregate view across
 * all forms.
 */
@Component({
	selector: 'mcms-form-submissions-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block p-6',
		'[attr.data-testid]': '"form-submissions-page"',
	},
	template: `
		<div class="space-y-4">
			<h1 class="text-2xl font-semibold">Form Submissions</h1>
			<p class="text-muted-foreground">
				View and manage submissions from all forms. Individual form submissions are also accessible
				via the Form Submissions collection.
			</p>
		</div>
	`,
})
export class FormSubmissionsPageComponent {}
