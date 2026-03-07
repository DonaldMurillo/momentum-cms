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

After changes, run: `npm run generate`

### 2. Provider-level (app.config.ts)

Registered via Angular DI providers. Takes effect immediately, no generation needed. Useful for app-specific customizations or login page slots.

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
admin: {
	components: {
		dashboard: () =>
			import('./app/custom-dashboard.component').then((m) => m.CustomDashboard),
	},
},
```

### Provider-level (app.config.ts)

```typescript
import { provideAdminComponent } from '@momentumcms/admin';

providers: [
	provideAdminComponent('dashboard', () =>
		import('./custom-dashboard.component').then((m) => m.CustomDashboard),
	),
],
```

### Per-Collection Page Overrides

Override pages for a specific collection only:

#### Config-level (on collection admin.components)

```typescript
admin: {
	components: {
		list: () => import('./custom-articles-list.component').then((m) => m.CustomArticlesList),
	},
},
```

#### Provider-level

```typescript
provideAdminComponent('collections/articles/list', () =>
	import('./custom-articles-list.component').then((m) => m.CustomArticlesList),
);
```

### Resolution Chain

1. Per-collection override (`collections/{slug}/{type}`)
2. Global override (`collection-list`)
3. Built-in default

## Layout Slots (Additive Injection)

Slots inject content around existing pages. Multiple components can register for the same slot.

### Available Slots

| Slot Key                               | Position                        |
| -------------------------------------- | ------------------------------- |
| `shell:header`                         | Top of main content area        |
| `shell:footer`                         | Bottom of main content area     |
| `shell:nav-start`                      | After Dashboard link in sidebar |
| `shell:nav-end`                        | After plugin routes in sidebar  |
| `dashboard:before/after`               | Around dashboard content        |
| `collection-list:before/after`         | Around list tables              |
| `collection-edit:before/after/sidebar` | Around edit forms               |
| `collection-view:before/after`         | Around view pages               |
| `login:before/after`                   | Around login form               |

### Config-level (momentum.config.ts — admin.components)

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

### Per-collection config keys

`beforeList`, `afterList`, `beforeEdit`, `afterEdit`, `editSidebar`, `beforeView`, `afterView`

### Provider-level (app.config.ts)

```typescript
import { provideAdminSlot } from '@momentumcms/admin';

providers: [
	provideAdminSlot('shell:header', () =>
		import('./env-banner.component').then((m) => m.EnvBanner),
	),
	// Per-collection:
	provideAdminSlot('collection-list:before:articles', () =>
		import('./articles-filter.component').then((m) => m.ArticlesFilter),
	),
],
```

## Component Template

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

## Exports from @momentumcms/admin

```typescript
import {
	provideAdminComponent, // Register page override via DI
	provideAdminSlot, // Register slot component via DI
} from '@momentumcms/admin';
```
