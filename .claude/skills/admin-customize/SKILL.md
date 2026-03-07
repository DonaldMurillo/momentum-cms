---
name: admin-customize
description: Customize the admin UI with swappable pages and layout slots. Use when replacing built-in pages (dashboard, list, edit, view), injecting content into layout slots (header, footer, sidebar, before/after), or registering per-collection overrides.
argument-hint: <page-override|slot|per-collection>
---

# Admin Customization — Swappable Pages & Layout Slots

Guide for customizing the Momentum CMS admin UI via page replacements and layout slot injection.

## Arguments

- `$ARGUMENTS` - What to customize: `page-override`, `slot`, or `per-collection`

## Two Registration Methods

### 1. Config-level (momentum.config.ts)

Registered in the server config. The code generator emits these as loader functions in the browser-safe generated config. This is the recommended approach — single source of truth.

### 2. Provider-level (app.config.ts)

Registered via Angular DI providers. Useful for app-specific customizations that don't belong in the server config, or for login page slots (which render outside the admin shell).

## Swappable Pages (Full Replacement)

### Available Page Keys

| Key               | Built-in Page   |
| ----------------- | --------------- |
| `dashboard`       | Dashboard       |
| `login`           | Login           |
| `media`           | Media Library   |
| `collection-list` | Collection List |
| `collection-edit` | Collection Edit |
| `collection-view` | Collection View |
| `global-edit`     | Global Edit     |

### Config-level (momentum.config.ts)

```typescript
import { defineMomentumConfig } from '@momentumcms/core';

export default defineMomentumConfig({
	// ...
	admin: {
		basePath: '/admin',
		components: {
			dashboard: () => import('./app/custom-dashboard.component').then((m) => m.CustomDashboard),
		},
	},
});
```

### Provider-level (app.config.ts)

```typescript
import { provideAdminComponent } from '@momentumcms/admin';

export const appConfig: ApplicationConfig = {
	providers: [
		provideAdminComponent('dashboard', () =>
			import('./custom-dashboard.component').then((m) => m.CustomDashboard),
		),
	],
};
```

### Per-Collection Page Overrides

Override pages for a specific collection only. Other collections keep the default.

#### Config-level (on the collection definition)

```typescript
const collections = baseCollections.map((c) => {
	if (c.slug === 'articles') {
		return {
			...c,
			admin: {
				...c.admin,
				components: {
					list: () =>
						import('./app/custom-articles-list.component').then(
							(m) => m.CustomArticlesListComponent,
						),
				},
			},
		};
	}
	return c;
});
```

#### Provider-level

```typescript
provideAdminComponent('collections/articles/list', () =>
	import('./custom-articles-list.component').then((m) => m.CustomArticlesList),
);
```

### Resolution Chain

For collection pages, the resolver checks in order:

1. Per-collection override (`collections/{slug}/{type}`)
2. Global override (`collection-list`)
3. Built-in default

## Layout Slots (Additive Injection)

Slots inject content around existing pages without replacing them. Multiple components can be registered for the same slot.

### Available Slots

#### Shell Slots (visible on all authenticated pages)

| Slot Key          | Position                        |
| ----------------- | ------------------------------- |
| `shell:header`    | Top of main content area        |
| `shell:footer`    | Bottom of main content area     |
| `shell:nav-start` | After Dashboard link in sidebar |
| `shell:nav-end`   | After plugin routes in sidebar  |

#### Page Slots

| Slot Key                               | Position                 |
| -------------------------------------- | ------------------------ |
| `dashboard:before/after`               | Around dashboard content |
| `collection-list:before/after`         | Around list tables       |
| `collection-edit:before/after/sidebar` | Around edit forms        |
| `collection-view:before/after`         | Around view pages        |
| `login:before/after`                   | Around login form        |

### Config-level (momentum.config.ts — admin.components)

Config-level slots use camelCase keys that map to slot positions:

| Config Key         | Slot Position      |
| ------------------ | ------------------ |
| `beforeNavigation` | `shell:nav-start`  |
| `afterNavigation`  | `shell:nav-end`    |
| `header`           | `shell:header`     |
| `footer`           | `shell:footer`     |
| `beforeDashboard`  | `dashboard:before` |
| `afterDashboard`   | `dashboard:after`  |
| `beforeLogin`      | `login:before`     |
| `afterLogin`       | `login:after`      |

```typescript
admin: {
	components: {
		beforeDashboard: () =>
			import('./app/announcement-banner.component').then((m) => m.AnnouncementBanner),
		footer: () =>
			import('./app/custom-footer.component').then((m) => m.CustomFooter),
	},
},
```

### Config-level (per-collection slots)

```typescript
// In the collection definition:
admin: {
	components: {
		beforeList: () => import('./articles-filter.component').then((m) => m.ArticlesFilter),
		editSidebar: () => import('./meta-panel.component').then((m) => m.MetaPanel),
		beforeView: () => import('./status-badge.component').then((m) => m.StatusBadge),
	},
},
```

Per-collection config keys: `beforeList`, `afterList`, `beforeEdit`, `afterEdit`, `editSidebar`, `beforeView`, `afterView`.

### Provider-level (app.config.ts)

```typescript
import { provideAdminSlot } from '@momentumcms/admin';

providers: [
	// Global slot (all pages)
	provideAdminSlot('shell:header', () =>
		import('./env-banner.component').then((m) => m.EnvBanner),
	),

	// Per-collection slot
	provideAdminSlot('collection-list:before:articles', () =>
		import('./articles-filter.component').then((m) => m.ArticlesFilter),
	),
],
```

### Per-Collection Slot Merging

When viewing a collection page, both global and per-collection slot components render (global first, then per-collection).

## Component Conventions

Custom components receive context via Angular inputs:

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CollectionConfig } from '@momentumcms/core';

@Component({
	selector: 'app-custom-slot',
	host: { class: 'block' },
	template: `
		<div class="p-4 bg-mcms-muted rounded-lg">
			@if (collection(); as col) {
				<p>Collection: {{ col.slug }}</p>
			}
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomSlotComponent {
	readonly collection = input<CollectionConfig>();
	readonly entityId = input<string>();
}
```

## After Making Changes

1. If you modified `momentum.config.ts`, regenerate the browser-safe config:
   ```bash
   nx run <app>:generate   # or npm run generate in generated apps
   ```
2. The generated config at `src/generated/momentum.config.ts` will include the component loaders with correct import paths.
3. Provider-level changes in `app.config.ts` take effect immediately (no generation needed).

## Plugin Registration

Plugins can declare admin component overrides:

```typescript
const myPlugin: MomentumPlugin = {
	name: 'my-plugin',
	adminComponents: {
		beforeDashboard: () => import('./plugin-banner').then((m) => m.PluginBanner),
		header: () => import('./custom-header').then((m) => m.CustomHeader),
	},
};
```

## Exports from @momentumcms/admin

```typescript
import {
	provideAdminComponent, // Register page override via DI
	provideAdminSlot, // Register slot component via DI
} from '@momentumcms/admin';
```

## Related Files

- `libs/core/src/lib/config.ts` — `AdminComponentsConfig` (global slots/pages)
- `libs/core/src/lib/collections/collection.types.ts` — `CollectionAdminComponentsConfig` (per-collection)
- `libs/admin/src/lib/services/admin-component-registry.service.ts` — Page resolver registry
- `libs/admin/src/lib/services/admin-slot-registry.service.ts` — Slot registry
- `libs/admin/src/lib/services/provide-admin-components.ts` — Provider functions
- `libs/admin/src/lib/components/admin-page-resolver/` — Route-level page resolver
- `libs/admin/src/lib/components/admin-slot-outlet/` — Slot rendering component
- `docs/admin/customization.md` — User-facing documentation
