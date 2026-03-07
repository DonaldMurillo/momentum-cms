import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Edit sidebar metadata — registered via per-collection config (articles.admin.components.editSidebar).
 * Renders in the sidebar panel next to the articles edit form.
 */
@Component({
	selector: 'test-edit-sidebar-meta',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div data-testid="edit-sidebar-meta" class="rounded-lg border border-border bg-card p-4">
			<p class="text-sm font-medium">Per-Collection Config Slot: editSidebar (articles)</p>
			<p class="text-xs text-muted-foreground mt-2">
				SEO preview, metadata, and other sidebar content.
			</p>
		</div>
	`,
})
export class EditSidebarMetaComponent {}
