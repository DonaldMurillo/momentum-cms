# Admin Customization

The admin UI supports two complementary extension points:

- **Swappable Pages** — Replace entire built-in pages with custom implementations
- **Layout Slots** — Inject content into named zones within existing pages

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

### Provider Registration

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

### Per-Collection Overrides

Override pages for specific collections by using the `collections/{slug}/{type}` key pattern:

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

| Slot Key          | Position                    |
| ----------------- | --------------------------- |
| `shell:header`    | Top of main content area    |
| `shell:footer`    | Bottom of main content area |
| `shell:nav-start` | After Dashboard link        |
| `shell:nav-end`   | After plugin routes         |

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

### Provider Registration

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
