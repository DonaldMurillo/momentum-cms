# SEO Plugin

The SEO plugin adds search engine optimization features to your Momentum CMS site: SEO field injection, content analysis, sitemap.xml, robots.txt, and a meta tag API.

## Installation

```bash
npm install @momentumcms/plugins-seo
```

## Configuration

```typescript
import { seoPlugin } from '@momentumcms/plugins-seo';

export default defineMomentumConfig({
	plugins: [
		seoPlugin({
			collections: ['posts', 'pages'],
			siteUrl: 'https://example.com',
			analysis: true,
			sitemap: true,
			robots: true,
			metaApi: true,
			adminDashboard: true,
		}),
	],
});
```

### Config Options

| Option               | Type                           | Default | Description                                          |
| -------------------- | ------------------------------ | ------- | ---------------------------------------------------- |
| `collections`        | `string[] \| '*'`              | —       | Collection slugs to inject SEO fields into           |
| `excludeCollections` | `string[]`                     | `[]`    | Collections to exclude (when `collections` is `'*'`) |
| `siteUrl`            | `string`                       | `''`    | Base URL for sitemaps and canonical URLs             |
| `analysis`           | `boolean \| SeoAnalysisConfig` | `true`  | SEO content analysis                                 |
| `sitemap`            | `boolean \| SitemapConfig`     | `true`  | Sitemap.xml generation                               |
| `robots`             | `boolean \| RobotsConfig`      | `true`  | Robots.txt generation                                |
| `metaApi`            | `boolean`                      | `true`  | Meta tag API endpoint                                |
| `adminDashboard`     | `boolean \| object`            | `true`  | Admin dashboard pages                                |
| `enabled`            | `boolean`                      | `true`  | Enable/disable the entire plugin                     |

## SEO Fields

When enabled, the plugin injects an `seo` field group into targeted collections with:

- `metaTitle` — Page title for search results
- `metaDescription` — Description shown in search snippets
- `canonicalUrl` — Canonical URL for duplicate content
- `focusKeyword` — Target keyword for analysis scoring
- `ogTitle`, `ogDescription`, `ogImage`, `ogType` — Open Graph tags
- `twitterCard` — Twitter card type
- `noIndex`, `noFollow` — Search engine directives
- `excludeFromSitemap` — Exclude from sitemap.xml
- `structuredData` — JSON-LD structured data

## Sitemap

Generates `/sitemap.xml` with all published documents from SEO-enabled collections.

### Sitemap Config

```typescript
seoPlugin({
	collections: ['posts'],
	siteUrl: 'https://example.com',
	sitemap: {
		defaultPriority: 0.7,
		defaultChangeFreq: 'weekly',
		cacheTtl: 300000, // 5 minutes
		priorities: { posts: 0.8 },
		changeFreqs: { posts: 'daily' },
	},
});
```

### Sitemap Settings

Sitemap settings are editable in the admin dashboard under **SEO > Sitemap**. Changes invalidate the cache automatically.

## Robots.txt

Generates `/robots.txt` with configurable rules.

### Robots Config

```typescript
seoPlugin({
	collections: ['posts'],
	siteUrl: 'https://example.com',
	robots: {
		crawlDelay: 1,
		rules: [{ userAgent: '*', allow: ['/'], disallow: ['/admin'] }],
	},
});
```

### Robots Settings

Robots.txt rules are editable in the admin dashboard under **SEO > Robots**.

## Meta Tag API

The meta tag API returns Open Graph, Twitter Card, and JSON-LD metadata for any document.

```bash
GET /seo/meta/:collection/:id
```

Returns:

```json
{
	"title": "My Post",
	"description": "Post description",
	"openGraph": { "title": "...", "description": "...", "image": "...", "type": "article" },
	"twitter": { "card": "summary_large_image" },
	"jsonLd": { "@context": "https://schema.org", "@type": "Article", "headline": "..." },
	"canonical": "https://example.com/posts/my-post"
}
```

## Content Analysis

The analysis engine scores documents on 10 rules (title length, description length, keyword presence, heading structure, etc.) and stores results in the `seo-analysis` collection.

Analysis runs automatically after document save. Results are displayed in the admin dashboard.

### Custom Thresholds

```typescript
seoPlugin({
	collections: ['posts'],
	analysis: {
		titleLength: { min: 40, max: 65 },
		descriptionLength: { min: 120, max: 160 },
		keywordDensity: { min: 1, max: 3 },
	},
});
```

## Admin Dashboard

When `adminDashboard` is enabled, the plugin adds three pages to the admin sidebar under the **SEO** group:

- **SEO** — Overview dashboard with analysis scores and recommendations
- **Sitemap** — View and configure sitemap settings per collection
- **Robots** — Edit robots.txt rules

## Related

- [Plugins Overview](overview.md) — Plugin system architecture
- [Writing a Plugin](writing-a-plugin.md) — Create your own plugin
