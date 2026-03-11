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

## Sidebar Icon Registration (REQUIRED for plugins and collections)

Any icon referenced by a plugin's `adminRoutes[].icon` or a collection's `admin.icon` MUST be registered in the admin sidebar. The E2E test suite (`Admin Sidebar Icons`) enforces that every sidebar nav item renders a visible SVG — unregistered icons silently produce empty `ng-icon` elements.

**File:** `libs/admin/src/lib/widgets/admin-sidebar/admin-sidebar.component.ts`

1. Import the icon from `@ng-icons/heroicons/outline`
2. Add it to the `provideIcons({...})` call in the component's `providers`
3. For collections: optionally add a slug → icon mapping in `collectionIcons`

Currently registered: `heroSquares2x2`, `heroNewspaper`, `heroUsers`, `heroPhoto`, `heroDocument`, `heroFolder`, `heroBolt`, `heroChevronUpDown`, `heroChartBarSquare`, `heroDocumentText`, `heroCog6Tooth`, `heroPuzzlePiece`, `heroMagnifyingGlass`, `heroMap`, `heroCursorArrowRays`, `heroEnvelopeOpen`, `heroQueueList`, `heroClock`, `heroSignal`.

Naming convention: `hero` + PascalCase (e.g., `heroEnvelopeOpen` for the `envelope-open` Heroicon).

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
