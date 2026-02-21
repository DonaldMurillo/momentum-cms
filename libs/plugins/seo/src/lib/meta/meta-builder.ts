/**
 * Meta Tag Builder
 *
 * Builds structured meta tag data from SEO field data.
 * Includes Open Graph, Twitter Card, canonical, and JSON-LD support.
 */

import type { SeoFieldData } from '../seo-config.types';
import type { MetaTags } from '../analysis/seo-analysis.types';

function extractOgImageUrl(ogImage: string | Record<string, unknown>): string | undefined {
	if (typeof ogImage === 'string') return ogImage;
	if (typeof ogImage === 'object' && ogImage !== null && 'url' in ogImage) {
		const url = ogImage['url'];
		return typeof url === 'string' ? url : undefined;
	}
	return undefined;
}

/**
 * Build structured meta tags from document SEO data.
 *
 * Falls back through: ogTitle → metaTitle → doc title field
 */
export function buildMetaTags(
	doc: Record<string, unknown>,
	seo: SeoFieldData,
	_siteUrl?: string,
): MetaTags {
	const title = seo.metaTitle ?? (typeof doc['title'] === 'string' ? doc['title'] : '');
	const meta: MetaTags['meta'] = [];
	const link: MetaTags['link'] = [];
	const script: MetaTags['script'] = [];

	// Description
	if (seo.metaDescription) {
		meta.push({ name: 'description', content: seo.metaDescription });
	}

	// Robots (noindex/nofollow)
	const robotsParts: string[] = [];
	if (seo.noIndex) robotsParts.push('noindex');
	if (seo.noFollow) robotsParts.push('nofollow');
	if (robotsParts.length > 0) {
		meta.push({ name: 'robots', content: robotsParts.join(', ') });
	}

	// Open Graph
	const ogTitle =
		seo.ogTitle ?? seo.metaTitle ?? (typeof doc['title'] === 'string' ? doc['title'] : '');
	if (ogTitle) {
		meta.push({ property: 'og:title', content: ogTitle });
	}

	const ogDescription = seo.ogDescription ?? seo.metaDescription;
	if (ogDescription) {
		meta.push({ property: 'og:description', content: ogDescription });
	}

	if (seo.ogImage) {
		const imageUrl = extractOgImageUrl(seo.ogImage);
		if (imageUrl) {
			meta.push({ property: 'og:image', content: imageUrl });
		}
	}

	if (seo.ogType) {
		meta.push({ property: 'og:type', content: seo.ogType });
	}

	// Twitter Card
	if (seo.twitterCard) {
		meta.push({ name: 'twitter:card', content: seo.twitterCard });
	}

	// Canonical URL
	if (seo.canonicalUrl) {
		link.push({ rel: 'canonical', href: seo.canonicalUrl });
	}

	// JSON-LD Structured Data — escape `<` to prevent </script> breakout (XSS)
	if (seo.structuredData) {
		script.push({
			type: 'application/ld+json',
			innerHTML: JSON.stringify(seo.structuredData).replace(/</g, '\\u003c'),
		});
	}

	return { title, meta, link, script };
}
