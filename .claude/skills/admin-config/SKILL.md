---
name: admin-config
description: Wire admin routes, configure browser-safe plugin imports, and create custom field renderers. Use when setting up momentumAdminRoutes, browserImports, or FieldRendererRegistry.
argument-hint: <routes|field-renderer|plugin-imports>
---

# Admin Config & Field Renderers

Reference for wiring admin routes, plugin browser imports, and custom field renderers.

## Arguments

- `$ARGUMENTS` - What to configure: `routes`, `field-renderer`, or `plugin-imports`

## Admin Config Generator

The admin config generator reads `momentum.config.ts` (server-side, Node) and outputs a browser-safe TypeScript file with proper imports. This eliminates manual wiring of collections, auth collections, and plugin routes in app routing.

### Usage in app routes

```typescript
import { momentumAdminRoutes } from '@momentumcms/admin';
import { adminConfig } from '../generated/momentum.config';

export const appRoutes: Route[] = [
	...momentumAdminRoutes(adminConfig),
	// app-specific routes...
];
```

### Plugin browserImports

Plugins declare browser-safe imports via `browserImports` on `MomentumPlugin`:

```typescript
browserImports: {
	collections: { path: '@momentumcms/auth/collections', exportName: 'BASE_AUTH_COLLECTIONS' },
	adminRoutes: { path: '@momentumcms/plugins/analytics/admin-routes', exportName: 'analyticsAdminRoutes' },
	modifyCollections: { path: '@momentumcms/plugins/analytics/block-fields', exportName: 'injectBlockAnalyticsFields' },
}
```

### Component loaders in generated config

The generator emits `admin.components` (global) and per-collection `admin.components` as lazy-loading functions with rewritten import paths. This means `momentum.config.ts` is the single source of truth for page overrides and layout slots.

For swappable pages and layout slots, see `/admin-customize`.

## Admin Icons

All heroicons/outline (324 icons) are provided globally at the admin route level via `provideAdminIcons()` in `libs/admin/src/lib/icons/provide-admin-icons.ts`. This is wired into `momentumAdminRoutes()` automatically — no manual icon registration needed anywhere.

Collections and plugins just set their `icon` field to any `hero*` name (e.g., `'heroEnvelopeOpen'`). The type is `hero${string}` for basic autocomplete. E2E tests enforce every sidebar item renders an SVG.

## Custom Field Renderers

Field renderers are lazily loaded via `FieldRendererRegistry`. Built-in renderers are registered with `provideMomentumFieldRenderers()`.

### App setup (required)

```typescript
import { provideMomentumFieldRenderers } from '@momentumcms/admin';

export const appConfig: ApplicationConfig = {
	providers: [provideMomentumFieldRenderers()],
};
```

### Adding a custom field type

```typescript
import { provideFieldRenderer } from '@momentumcms/admin';

export const appConfig: ApplicationConfig = {
	providers: [
		provideMomentumFieldRenderers(),
		provideFieldRenderer('color', () =>
			import('./renderers/color-field.component').then((m) => m.ColorFieldRenderer),
		),
	],
};
```
