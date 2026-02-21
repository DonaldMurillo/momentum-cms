import { describe, it, expect } from 'vitest';
import { buildMetaTags } from '../meta-builder';
import type { SeoFieldData } from '../../seo-config.types';

function buildTags(
	seo: SeoFieldData = {},
	doc: Record<string, unknown> = {},
	siteUrl?: string,
): ReturnType<typeof buildMetaTags> {
	return buildMetaTags(doc, seo, siteUrl);
}

describe('buildMetaTags', () => {
	it('should build title from metaTitle', () => {
		const tags = buildTags({ metaTitle: 'My Page Title' });
		expect(tags.title).toBe('My Page Title');
	});

	it('should fall back to doc title when no metaTitle', () => {
		const tags = buildTags({}, { title: 'Document Title' });
		expect(tags.title).toBe('Document Title');
	});

	it('should return empty title when no title data', () => {
		const tags = buildTags({}, {});
		expect(tags.title).toBe('');
	});

	it('should build description meta tag', () => {
		const tags = buildTags({ metaDescription: 'A great description' });
		expect(tags.meta).toContainEqual({
			name: 'description',
			content: 'A great description',
		});
	});

	it('should build OG title from ogTitle', () => {
		const tags = buildTags({ ogTitle: 'OG Title' });
		expect(tags.meta).toContainEqual({
			property: 'og:title',
			content: 'OG Title',
		});
	});

	it('should fall back OG title to metaTitle', () => {
		const tags = buildTags({ metaTitle: 'Meta Title' });
		expect(tags.meta).toContainEqual({
			property: 'og:title',
			content: 'Meta Title',
		});
	});

	it('should fall back OG title to doc title', () => {
		const tags = buildTags({}, { title: 'Doc Title' });
		expect(tags.meta).toContainEqual({
			property: 'og:title',
			content: 'Doc Title',
		});
	});

	it('should build OG description from ogDescription', () => {
		const tags = buildTags({ ogDescription: 'OG Desc' });
		expect(tags.meta).toContainEqual({
			property: 'og:description',
			content: 'OG Desc',
		});
	});

	it('should fall back OG description to metaDescription', () => {
		const tags = buildTags({ metaDescription: 'Meta Desc' });
		expect(tags.meta).toContainEqual({
			property: 'og:description',
			content: 'Meta Desc',
		});
	});

	it('should build OG image from string URL', () => {
		const tags = buildTags({ ogImage: 'https://example.com/img.jpg' });
		expect(tags.meta).toContainEqual({
			property: 'og:image',
			content: 'https://example.com/img.jpg',
		});
	});

	it('should build OG image from object with url field', () => {
		const tags = buildTags({
			ogImage: { url: 'https://example.com/img.jpg' } as Record<string, unknown>,
		});
		expect(tags.meta).toContainEqual({
			property: 'og:image',
			content: 'https://example.com/img.jpg',
		});
	});

	it('should build OG type', () => {
		const tags = buildTags({ ogType: 'article' });
		expect(tags.meta).toContainEqual({
			property: 'og:type',
			content: 'article',
		});
	});

	it('should build Twitter Card meta tag', () => {
		const tags = buildTags({ twitterCard: 'summary_large_image' });
		expect(tags.meta).toContainEqual({
			name: 'twitter:card',
			content: 'summary_large_image',
		});
	});

	it('should build canonical link', () => {
		const tags = buildTags({ canonicalUrl: 'https://example.com/page' });
		expect(tags.link).toContainEqual({
			rel: 'canonical',
			href: 'https://example.com/page',
		});
	});

	it('should build JSON-LD script from structuredData', () => {
		const structuredData = { '@type': 'Article', name: 'Test' };
		const tags = buildTags({ structuredData });
		expect(tags.script).toHaveLength(1);
		expect(tags.script[0].type).toBe('application/ld+json');
		expect(JSON.parse(tags.script[0].innerHTML)).toEqual(structuredData);
	});

	it('should escape </script> sequences in JSON-LD to prevent XSS', () => {
		const structuredData = { name: '</script><script>alert(1)</script>' };
		const tags = buildTags({ structuredData });
		expect(tags.script).toHaveLength(1);
		// Must not contain literal </script> which would break out of script tag
		expect(tags.script[0].innerHTML).not.toContain('</script>');
		// But the parsed JSON should still have the original value
		expect(JSON.parse(tags.script[0].innerHTML)).toEqual(structuredData);
	});

	it('should escape nested </script> in complex JSON-LD', () => {
		const structuredData = {
			'@type': 'Article',
			author: { name: 'Test</script><img src=x onerror=alert(1)>' },
		};
		const tags = buildTags({ structuredData });
		expect(tags.script[0].innerHTML).not.toContain('</');
		expect(JSON.parse(tags.script[0].innerHTML)).toEqual(structuredData);
	});

	it('should include noindex in robots meta when set', () => {
		const tags = buildTags({ noIndex: true });
		expect(tags.meta).toContainEqual({
			name: 'robots',
			content: 'noindex',
		});
	});

	it('should include nofollow in robots meta when set', () => {
		const tags = buildTags({ noFollow: true });
		expect(tags.meta).toContainEqual({
			name: 'robots',
			content: 'nofollow',
		});
	});

	it('should combine noindex and nofollow', () => {
		const tags = buildTags({ noIndex: true, noFollow: true });
		expect(tags.meta).toContainEqual({
			name: 'robots',
			content: 'noindex, nofollow',
		});
	});

	it('should not include robots meta when neither set', () => {
		const tags = buildTags({});
		const robotsMeta = tags.meta.find((m) => m.name === 'robots');
		expect(robotsMeta).toBeUndefined();
	});

	it('should handle missing seo data gracefully', () => {
		const tags = buildTags({}, {});
		expect(tags.title).toBe('');
		expect(tags.meta).toEqual([]);
		expect(tags.link).toEqual([]);
		expect(tags.script).toEqual([]);
	});

	it('should build complete meta tags set', () => {
		const tags = buildTags(
			{
				metaTitle: 'Page Title',
				metaDescription: 'Description',
				ogTitle: 'OG Title',
				ogDescription: 'OG Desc',
				ogImage: 'https://example.com/img.jpg',
				ogType: 'article',
				twitterCard: 'summary',
				canonicalUrl: 'https://example.com/page',
				structuredData: { '@type': 'Article' },
			},
			{ title: 'Doc Title' },
		);

		expect(tags.title).toBe('Page Title');
		expect(tags.meta.length).toBeGreaterThanOrEqual(6);
		expect(tags.link).toHaveLength(1);
		expect(tags.script).toHaveLength(1);
	});
});
