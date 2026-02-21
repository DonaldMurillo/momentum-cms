/**
 * @momentumcms/plugins/seo
 *
 * SEO plugin for Momentum CMS.
 * Provides meta tags, sitemap, robots.txt, and content analysis.
 */

// Plugin factory
export { seoPlugin } from './lib/seo-plugin';

// Config types
export type {
	SeoPluginConfig,
	SeoAnalysisConfig,
	SeoScoringRule,
	SeoScoringContext,
	SeoFieldData,
	SitemapConfig,
	SitemapChangeFreq,
	RobotsConfig,
	RobotsRule,
} from './lib/seo-config.types';

// Analysis types
export type { SeoAnalysisResult, SeoRuleResult, MetaTags } from './lib/analysis/seo-analysis.types';

// Field injector (also exported via @momentumcms/plugins/seo/fields sub-path)
export { injectSeoFields } from './lib/seo-field-injector';
export type { SeoFieldInjectorOptions } from './lib/seo-field-injector';
