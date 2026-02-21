/**
 * SEO Plugin Configuration Types
 *
 * All configuration interfaces for the Momentum CMS SEO plugin.
 */

// ============================================
// Main Plugin Config
// ============================================

/**
 * SEO Plugin Configuration.
 *
 * @example
 * ```typescript
 * seoPlugin({
 *   collections: ['posts', 'pages'],
 *   siteUrl: 'https://example.com',
 *   analysis: { titleLength: { min: 40, max: 65 } },
 *   sitemap: { defaultPriority: 0.7 },
 *   robots: { crawlDelay: 1 },
 * })
 * ```
 */
export interface SeoPluginConfig {
	/** Enable/disable the SEO plugin. @default true */
	enabled?: boolean;

	/**
	 * Collection slugs to inject SEO fields into.
	 * Pass `'*'` to inject into all collections (except managed and internal).
	 */
	collections: string[] | '*';

	/**
	 * Collections to exclude from SEO field injection.
	 * Only effective when `collections` is `'*'`.
	 */
	excludeCollections?: string[];

	/**
	 * Base URL for the site (used in sitemaps, canonical URLs, Open Graph).
	 * e.g., `'https://example.com'`
	 */
	siteUrl?: string;

	/**
	 * SEO analysis configuration.
	 * - `true` (default): enable with default settings
	 * - `false`: disable analysis
	 * - object: custom thresholds and rules
	 */
	analysis?: boolean | SeoAnalysisConfig;

	/**
	 * Sitemap generation configuration.
	 * - `true` (default): enable with default settings
	 * - `false`: disable sitemap endpoint
	 * - object: custom sitemap settings
	 */
	sitemap?: boolean | SitemapConfig;

	/**
	 * Robots.txt configuration.
	 * - `true` (default): enable with default settings
	 * - `false`: disable robots.txt endpoint
	 * - object: custom robots.txt rules
	 */
	robots?: boolean | RobotsConfig;

	/**
	 * Meta tag API configuration.
	 * - `true` (default): enable
	 * - `false`: disable
	 */
	metaApi?: boolean;

	/**
	 * Admin dashboard configuration.
	 * - `true` (default): enable built-in dashboard
	 * - `false`: disable
	 * - object: override loadComponent and/or group
	 */
	adminDashboard?:
		| boolean
		| {
				loadComponent?: unknown;
				group?: string;
		  };
}

// ============================================
// Analysis Config
// ============================================

export interface SeoAnalysisConfig {
	/** Run analysis asynchronously after save. @default true */
	async?: boolean;

	/** Custom scoring rules to add or override defaults */
	rules?: SeoScoringRule[];

	/** Title length thresholds */
	titleLength?: { min: number; max: number };

	/** Meta description length thresholds */
	descriptionLength?: { min: number; max: number };

	/** Target keyword density range (percentage) */
	keywordDensity?: { min: number; max: number };

	/** Collections to exclude from analysis */
	excludeCollections?: string[];
}

export interface SeoScoringRule {
	/** Unique rule identifier */
	id: string;
	/** Rule display name */
	name: string;
	/** Weight (0-100) in the total score */
	weight: number;
	/** Scoring function returning 0-100 */
	score: (context: SeoScoringContext) => number;
	/** Human-readable recommendation when score is low */
	recommendation: (context: SeoScoringContext) => string | null;
}

export interface SeoScoringContext {
	/** The SEO group field data */
	seo: SeoFieldData;
	/** The full document data */
	doc: Record<string, unknown>;
	/** The collection slug */
	collection: string;
	/** Extracted plain text from rich text fields */
	textContent: string;
	/** Extracted headings from rich text content */
	headings: Array<{ level: number; text: string }>;
}

export interface SeoFieldData {
	metaTitle?: string;
	metaDescription?: string;
	canonicalUrl?: string;
	focusKeyword?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string | Record<string, unknown>;
	ogType?: string;
	twitterCard?: string;
	noIndex?: boolean;
	noFollow?: boolean;
	excludeFromSitemap?: boolean;
	structuredData?: unknown;
}

// ============================================
// Sitemap Config
// ============================================

export type SitemapChangeFreq =
	| 'always'
	| 'hourly'
	| 'daily'
	| 'weekly'
	| 'monthly'
	| 'yearly'
	| 'never';

export interface SitemapConfig {
	/** Collections to include (default: all with SEO fields) */
	includeCollections?: string[];
	/** Collections to exclude */
	excludeCollections?: string[];
	/** Default priority for sitemap entries (0.0-1.0). @default 0.5 */
	defaultPriority?: number;
	/** Per-collection priority overrides */
	priorities?: Record<string, number>;
	/** Default change frequency. @default 'weekly' */
	defaultChangeFreq?: SitemapChangeFreq;
	/** Per-collection change frequency overrides */
	changeFreqs?: Record<string, SitemapChangeFreq>;
	/** Cache TTL in milliseconds. @default 300000 (5 minutes) */
	cacheTtl?: number;
	/** Maximum URLs per sitemap file (for sitemap index). @default 50000 */
	maxUrlsPerSitemap?: number;
	/** Custom URL builder per collection */
	urlBuilder?: (collection: string, doc: Record<string, unknown>) => string | null;
}

// ============================================
// Robots Config
// ============================================

export interface RobotsConfig {
	/** User-agent rules */
	rules?: RobotsRule[];
	/** Additional sitemap URLs to include */
	additionalSitemaps?: string[];
	/** Crawl delay in seconds */
	crawlDelay?: number;
}

export interface RobotsRule {
	userAgent: string;
	allow?: string[];
	disallow?: string[];
}
