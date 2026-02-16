import { Component, ChangeDetectionStrategy, inject, computed, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { CollectionConfig, GlobalConfig } from '@momentumcms/core';
import { humanizeFieldName } from '@momentumcms/core';
import { getGlobalsFromRouteData } from '../../utils/route-data';
import { EntityFormWidget } from '../../widgets/entity-form/entity-form.component';
import type { HasUnsavedChanges } from '../../guards/unsaved-changes.guard';

/**
 * Global Edit Page
 *
 * Renders the EntityFormWidget in global (singleton) mode for editing a global document.
 * The global config is converted to a CollectionConfig shape and passed with isGlobal=true.
 */
@Component({
	selector: 'mcms-global-edit',
	imports: [EntityFormWidget],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	template: `
		@if (collectionConfig(); as col) {
			<mcms-entity-form
				#entityForm
				[collection]="col"
				[mode]="'edit'"
				[basePath]="'/admin/globals'"
				[showBreadcrumbs]="true"
				[isGlobal]="true"
				[globalSlug]="globalSlug()"
			/>
		} @else {
			<div class="p-12 text-center text-muted-foreground">Global not found</div>
		}
	`,
})
export class GlobalEditPage implements HasUnsavedChanges {
	private readonly route = inject(ActivatedRoute);

	private readonly entityFormRef = viewChild<EntityFormWidget>('entityForm');

	readonly globalSlug = computed((): string => {
		return this.route.snapshot.paramMap.get('slug') ?? '';
	});

	readonly globalConfig = computed((): GlobalConfig | undefined => {
		const slug = this.globalSlug();
		const globals = getGlobalsFromRouteData(this.route.parent?.snapshot.data);
		return globals.find((g) => g.slug === slug);
	});

	/** Convert GlobalConfig to CollectionConfig shape for EntityFormWidget */
	readonly collectionConfig = computed((): CollectionConfig | undefined => {
		const global = this.globalConfig();
		if (!global) return undefined;

		return {
			slug: global.slug,
			fields: global.fields,
			labels: {
				singular: global.label ?? humanizeFieldName(global.slug),
				plural: global.label ?? humanizeFieldName(global.slug),
			},
			admin: global.admin,
			access: global.access
				? { read: global.access.read, update: global.access.update }
				: undefined,
			hooks: global.hooks,
			versions: global.versions,
		};
	});

	hasUnsavedChanges(): boolean {
		return this.entityFormRef()?.isDirty() ?? false;
	}
}
