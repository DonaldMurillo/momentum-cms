---
name: add-plugin
description: Add and configure a Momentum CMS plugin
argument-hint: <plugin-name>
---

# Add Momentum CMS Plugin

Add and configure a plugin in this Momentum CMS project.

## Arguments

- `$ARGUMENTS` - Plugin name: "seo", "analytics", "otel", "event-bus", or an npm package name

## Steps

1. Identify the plugin to install
2. Install the package (if not already a dependency)
3. Import the plugin factory in `src/momentum.config.ts`
4. Configure the plugin and add to the `plugins` array
5. Run `npm run generate` to regenerate types and admin config
6. Remind the user to restart the dev server

## Official Plugins

### SEO (`@momentumcms/plugins-seo`)

Adds SEO fields to collections, sitemap.xml, robots.txt, meta tag API, and an admin dashboard. **Included by default** in scaffolded projects.

```bash
npm install @momentumcms/plugins-seo
```

```typescript
// In src/momentum.config.ts
import { seoPlugin } from '@momentumcms/plugins-seo';

const seo = seoPlugin({
	collections: ['posts'], // Collection slugs to inject SEO fields into (or '*' for all)
	siteUrl: BASE_URL, // Base URL for sitemaps and canonical URLs
	analysis: true, // Enable SEO scoring analysis on save
	sitemap: true, // Enable /sitemap.xml endpoint
	robots: true, // Enable /robots.txt endpoint
	metaApi: true, // Enable /api/seo/meta/:collection/:id endpoint
	adminDashboard: true, // Enable SEO admin pages (dashboard, sitemap, robots)
});

const config = defineMomentumConfig({
	// ...existing config
	plugins: [authPlugin, seo],
});
```

**What it adds:**

- SEO fields (title, description, keywords, Open Graph, Twitter cards) injected into specified collections via a tabbed "SEO" section
- SEO analysis scoring (title length, description, keyword density) with per-document scores
- Sitemap.xml generation from published documents
- Robots.txt generation with configurable rules
- Meta tag API endpoint for headless frontends
- Admin dashboard with SEO overview, sitemap settings, and robots.txt editor

### Analytics (`@momentumcms/plugins-analytics`)

Adds event tracking, content performance dashboard, and block-level analytics.

```bash
npm install @momentumcms/plugins-analytics
```

```typescript
// In src/momentum.config.ts
import { analyticsPlugin } from '@momentumcms/plugins-analytics';

const analytics = analyticsPlugin({
	trackCollections: true,
});

const config = defineMomentumConfig({
	// ...existing config
	plugins: [authPlugin, analytics],
});
```

**What it adds:**

- Analytics dashboard admin page
- Content performance admin page
- Tracking rules collection
- Block-level impression and hover tracking fields
- CRUD event tracking hooks on all collections

### OpenTelemetry (`@momentumcms/plugins-otel`)

Adds distributed tracing with OpenTelemetry spans for all collection operations.

```bash
npm install @momentumcms/plugins-otel
```

```typescript
// In src/momentum.config.ts
import { otelPlugin } from '@momentumcms/plugins-otel';

const tracing = otelPlugin({
	serviceName: 'my-cms',
});

const config = defineMomentumConfig({
	// ...existing config
	plugins: [authPlugin, tracing],
});
```

**What it adds:**

- Tracing hooks (before/afterChange, before/afterDelete) on all collections
- OTel log enricher for trace/span IDs

### Event Bus (`@momentumcms/plugins-core`)

Pub/sub for collection lifecycle events. Already installed as a dependency.

```typescript
// In src/momentum.config.ts
import { eventBusPlugin } from '@momentumcms/plugins-core';

const events = eventBusPlugin();

const config = defineMomentumConfig({
	// ...existing config
	plugins: [authPlugin, events],
});

// Subscribe to events anywhere:
events.bus.on('posts:afterChange', ({ doc, operation }) => {
	console.log(`Post ${operation}:`, doc.title);
});
```

**What it adds:**

- Event hooks on all collections
- Typed event bus for subscribing to collection events

## After Adding a Plugin

```bash
npm run generate    # Regenerate types and admin config
npm run dev         # Restart dev server
```

## Custom Plugins

For writing your own plugin, see the [Writing a Plugin](https://github.com/DonaldMurillo/momentum-cms/blob/main/docs/plugins/writing-a-plugin.md) documentation.

A custom plugin implements the `MomentumPlugin` interface:

```typescript
import type { MomentumPlugin } from '@momentumcms/core';

export function myPlugin(config: MyConfig): MomentumPlugin {
	return {
		name: 'my-plugin',
		collections: [], // Optional: add collections
		adminRoutes: [], // Optional: add admin pages
		modifyCollections(collections) {}, // Optional: inject fields/hooks
		async onInit(context) {}, // Optional: before API init
		async onReady(context) {}, // Optional: after API ready
		async onShutdown(context) {}, // Optional: graceful shutdown
	};
}
```
