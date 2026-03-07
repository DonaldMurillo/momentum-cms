# Admin Customization

The admin UI supports two complementary extension points:

- **Swappable Pages** — Replace entire built-in pages with custom implementations
- **Layout Slots** — Inject content into named zones within existing pages

Both support two registration methods:

- **Config-level** (`momentum.config.ts`) — Single source of truth, emitted to the generated browser-safe config
- **Provider-level** (`app.config.ts`) — Angular DI providers, no regeneration needed

## Swappable Pages

Replace any built-in admin page with a custom component.

### Available Page Keys

| Key               | Built-in Page   | Description             |
| ----------------- | --------------- | ----------------------- |
| `dashboard`       | Dashboard       | Collection cards grid   |
| `login`           | Login           | Authentication form     |
| `media`           | Media Library   | File management         |
| `collection-list` | Collection List | Per-collection override |
| `collection-edit` | Collection Edit | Per-collection override |
| `collection-view` | Collection View | Per-collection override |
| `global-edit`     | Global Edit     | Global document editor  |

### Config-level Registration

Register global page overrides in `momentum.config.ts`:

```typescript
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

After changes, run `npm run generate` (or `nx run <app>:generate`) to update the browser-safe config.

### Provider-level Registration

Register overrides in your Angular `ApplicationConfig`:

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

Override pages for specific collections while other collections keep the default.

#### Config-level (on collection definition)

```typescript
const articles = defineCollection({
	slug: 'articles',
	admin: {
		useAsTitle: 'title',
		components: {
			list: () =>
				import('./app/custom-articles-list.component').then((m) => m.CustomArticlesListComponent),
		},
	},
	fields: [
		/* ... */
	],
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

## Layout Slots

Inject content into named positions within existing pages. Slots are additive — multiple components can be registered for the same slot.

### Available Slots

#### Shell Slots

| Slot Key          | Position                        |
| ----------------- | ------------------------------- |
| `shell:header`    | Top of main content area        |
| `shell:footer`    | Bottom of main content area     |
| `shell:nav-start` | After Dashboard link in sidebar |
| `shell:nav-end`   | After plugin routes in sidebar  |

#### Dashboard Slots

| Slot Key           | Position                 |
| ------------------ | ------------------------ |
| `dashboard:before` | Before dashboard content |
| `dashboard:after`  | After collections grid   |

#### Collection List Slots

| Slot Key                 | Position           |
| ------------------------ | ------------------ |
| `collection-list:before` | Before entity list |
| `collection-list:after`  | After entity list  |

#### Collection Edit Slots

| Slot Key                  | Position        |
| ------------------------- | --------------- |
| `collection-edit:before`  | Before the form |
| `collection-edit:after`   | After the form  |
| `collection-edit:sidebar` | Sidebar panel   |

#### Collection View Slots

| Slot Key                 | Position        |
| ------------------------ | --------------- |
| `collection-view:before` | Before the view |
| `collection-view:after`  | After the view  |

#### Login Slots

| Slot Key       | Position          |
| -------------- | ----------------- |
| `login:before` | Before login form |
| `login:after`  | After login form  |

### Config-level Registration

Global slots use camelCase keys in `admin.components`:

| Config Key         | Maps to Slot       |
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

Per-collection slots use camelCase keys in the collection's `admin.components`:

| Config Key    | Maps to Slot                     |
| ------------- | -------------------------------- |
| `beforeList`  | `collection-list:before:{slug}`  |
| `afterList`   | `collection-list:after:{slug}`   |
| `beforeEdit`  | `collection-edit:before:{slug}`  |
| `afterEdit`   | `collection-edit:after:{slug}`   |
| `editSidebar` | `collection-edit:sidebar:{slug}` |
| `beforeView`  | `collection-view:before:{slug}`  |
| `afterView`   | `collection-view:after:{slug}`   |

### Provider-level Registration

```typescript
import { provideAdminSlot } from '@momentumcms/admin';

export const appConfig: ApplicationConfig = {
	providers: [
		provideAdminSlot('dashboard:before', () =>
			import('./welcome-banner.component').then((m) => m.WelcomeBanner),
		),
	],
};
```

### Per-Collection Slots

Collection slots automatically merge global and per-collection loaders. Register a per-collection slot by including the collection slug in the key:

```typescript
// Applies to all collection lists
provideAdminSlot('collection-list:before', () =>
	import('./global-filter.component').then((m) => m.GlobalFilter),
);

// Applies only to the articles collection list
provideAdminSlot('collection-list:before:articles', () =>
	import('./articles-filter.component').then((m) => m.ArticlesFilter),
);
```

When viewing the articles collection, both components render (global first, then per-collection).

## Slot Component Context

Slot components receive context via Angular inputs:

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CollectionConfig } from '@momentumcms/core';

@Component({
	selector: 'app-status-badge',
	host: { class: 'block' },
	template: `
		<div class="p-4 bg-mcms-muted rounded-lg">
			@if (collection(); as col) {
				<p>Viewing: {{ col.slug }}</p>
			}
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
	readonly collection = input<CollectionConfig>();
	readonly entityId = input<string>();
}
```

## Plugin Registration

Plugins can declare admin components via `adminComponents`:

```typescript
const myPlugin: MomentumPlugin = {
	name: 'my-plugin',
	adminComponents: {
		beforeDashboard: () => import('./plugin-banner').then((m) => m.PluginBanner),
	},
};
```

## Related

- [Admin Overview](overview.md) — Dashboard pages and navigation
- [Writing a Plugin](../plugins/writing-a-plugin.md) — Plugin development guide
