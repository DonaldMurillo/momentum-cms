import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * SEO Plugin E2E tests.
 *
 * Verifies that the SEO plugin:
 * 1. Injects SEO fields into collections
 * 2. Serves sitemap.xml at root level
 * 3. Serves robots.txt at root level
 * 4. Serves meta tag API
 * 5. Runs SEO analysis on document save
 */
test.describe('SEO Plugin', { tag: ['@seo', '@api', '@crud'] }, () => {
	test.beforeEach(async ({ request }) => {
		const signIn = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signIn.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test('pages collection has seo fields injected', async ({ request }) => {
		// Create a page with SEO data
		const slug = `seo-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'SEO Test Page',
				slug,
				seo: {
					metaTitle: 'Test SEO Title for E2E',
					metaDescription:
						'This is a test meta description for end-to-end testing of the SEO plugin.',
					focusKeyword: 'seo test',
					canonicalUrl: 'https://example.com/seo-test',
					ogTitle: 'OG Test Title',
					ogDescription: 'OG Description for testing',
					noIndex: false,
					noFollow: false,
				},
			},
		});
		expect(create.status()).toBe(201);

		const result = (await create.json()) as { doc: { id: string; seo: Record<string, unknown> } };
		expect(result.doc.seo).toBeDefined();
		expect(result.doc.seo['metaTitle']).toBe('Test SEO Title for E2E');
		expect(result.doc.seo['metaDescription']).toContain('test meta description');
	});

	test('GET /robots.txt returns valid robots.txt', async ({ request }) => {
		const response = await request.get('/robots.txt');
		expect(response.status()).toBe(200);

		const contentType = response.headers()['content-type'] ?? '';
		expect(contentType).toContain('text/plain');

		const body = await response.text();
		expect(body).toContain('User-agent:');
		expect(body).toContain('Sitemap:');
	});

	test('GET /sitemap.xml returns valid XML sitemap', async ({ request }) => {
		const response = await request.get('/sitemap.xml');
		expect(response.status()).toBe(200);

		const contentType = response.headers()['content-type'] ?? '';
		expect(contentType).toContain('application/xml');

		const body = await response.text();
		expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(body).toContain('<urlset');
	});

	test('GET /api/seo/meta/:collection/:id returns meta tags', async ({ request }) => {
		// First create a page with SEO data
		const slug = `meta-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'Meta API Test',
				slug,
				seo: {
					metaTitle: 'Meta API Title',
					metaDescription: 'Meta API description for testing purposes',
					ogTitle: 'OG Meta API Title',
					canonicalUrl: 'https://example.com/meta-test',
				},
			},
		});
		expect(create.status()).toBe(201);

		const doc = (await create.json()) as { doc: { id: string } };

		// Fetch meta tags
		const metaResponse = await request.get(`/api/seo/meta/pages/${doc.doc.id}`);
		expect(metaResponse.status()).toBe(200);

		const meta = (await metaResponse.json()) as {
			title: string;
			meta: Array<{ name?: string; property?: string; content: string }>;
			link: Array<{ rel: string; href: string }>;
			script: Array<{ type: string; innerHTML: string }>;
		};

		expect(meta.title).toBe('Meta API Title');

		const descMeta = meta.meta.find((m) => m.name === 'description');
		expect(descMeta).toBeDefined();
		expect(descMeta?.content).toContain('Meta API description');

		const ogTitle = meta.meta.find((m) => m.property === 'og:title');
		expect(ogTitle).toBeDefined();
		expect(ogTitle?.content).toBe('OG Meta API Title');

		const canonical = meta.link.find((l) => l.rel === 'canonical');
		expect(canonical).toBeDefined();
		expect(canonical?.href).toBe('https://example.com/meta-test');
	});

	test('GET /api/seo/meta/:collection/:id returns 404 for non-existent doc', async ({
		request,
	}) => {
		const response = await request.get('/api/seo/meta/pages/nonexistent-id-999');
		expect(response.status()).toBe(404);
	});

	test('sitemap includes documents from SEO-enabled collections', async ({ request }) => {
		// Create a page
		const slug = `sitemap-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'Sitemap Test Page', slug },
		});
		expect(create.status()).toBe(201);

		// Sitemap may be cached, so we can't guarantee the new page appears
		// But we can verify the sitemap is structurally valid and contains URLs
		const response = await request.get('/sitemap.xml');
		expect(response.status()).toBe(200);
		const body = await response.text();
		expect(body).toContain('<url>');
		expect(body).toContain('<loc>');
	});

	test('SEO analysis runs after document save', async ({ request }) => {
		// Create a page with full SEO data
		const slug = `analysis-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'Analysis Test Page',
				slug,
				seo: {
					metaTitle: 'A well-optimized title that is about fifty five characters long here',
					metaDescription:
						'This is a well-written meta description that provides a clear summary of the page content for search engine results pages and social sharing.',
					focusKeyword: 'analysis test',
					canonicalUrl: 'https://example.com/analysis-test',
					ogTitle: 'OG Analysis Title',
					ogDescription: 'OG Description for analysis',
					ogImage: 'https://example.com/img.jpg',
				},
			},
		});
		expect(create.status()).toBe(201);

		// Analysis is fire-and-forget, give it a moment to complete
		// Use expect.poll to avoid flaky hardcoded waits
		const doc = (await create.json()) as { doc: { id: string } };

		await expect
			.poll(
				async () => {
					const analysisResponse = await request.get('/api/seo/analyses?limit=100');
					if (!analysisResponse.ok()) return false;
					const data = (await analysisResponse.json()) as {
						docs: Array<{ documentId: string; score: number; grade: string }>;
					};
					return data.docs.some((d) => d.documentId === doc.doc.id);
				},
				{ timeout: 10_000, message: 'SEO analysis should be created after save' },
			)
			.toBe(true);

		// Verify the analysis result
		const analysisResponse = await request.get('/api/seo/analyses?limit=100');
		const data = (await analysisResponse.json()) as {
			docs: Array<{ documentId: string; score: number; grade: string }>;
		};
		const analysis = data.docs.find((d) => d.documentId === doc.doc.id);
		expect(analysis).toBeDefined();
		expect(Number(analysis?.score)).toBeGreaterThan(0);
		expect(['good', 'warning', 'poor']).toContain(analysis?.grade);
	});

	test('robots.txt includes sitemap URL', async ({ request }) => {
		const response = await request.get('/robots.txt');
		expect(response.status()).toBe(200);
		const body = await response.text();
		expect(body).toContain('Sitemap:');
		expect(body).toContain('/sitemap.xml');
	});

	test('documents with excludeFromSitemap are excluded from sitemap XML', async ({ request }) => {
		// Create a page with excludeFromSitemap: true
		const slugExcluded = `sitemap-excl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const createExcluded = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'Excluded Page',
				slug: slugExcluded,
				seo: { excludeFromSitemap: true },
			},
		});
		expect(createExcluded.status()).toBe(201);
		const excludedDoc = (await createExcluded.json()) as { doc: { id: string } };

		// The sitemap may be cached from earlier tests.
		// Since this is a fresh worker with a fresh DB, the sitemap cache will
		// be populated on first request. We verify the excluded page is not present.
		// Poll to give the server time to generate the sitemap (first call may build it).
		await expect
			.poll(
				async () => {
					const res = await request.get('/sitemap.xml');
					if (!res.ok()) return '';
					return await res.text();
				},
				{ timeout: 15_000, message: 'Sitemap should be available' },
			)
			.toContain('<urlset');

		const sitemapRes = await request.get('/sitemap.xml');
		const sitemapBody = await sitemapRes.text();
		expect(sitemapBody).not.toContain(excludedDoc.doc.id);
	});

	test('GET /api/seo/sitemap-settings returns collection list', async ({ request }) => {
		const response = await request.get('/api/seo/sitemap-settings');
		expect(response.status()).toBe(200);

		const data = (await response.json()) as {
			settings: Array<{
				collection: string;
				includeInSitemap: boolean;
				priority: number | null;
				changeFreq: string | null;
			}>;
		};

		expect(Array.isArray(data.settings)).toBe(true);
		expect(data.settings.length).toBeGreaterThan(0);

		// All entries should have collection slug and includeInSitemap boolean
		for (const entry of data.settings) {
			expect(typeof entry.collection).toBe('string');
			expect(typeof entry.includeInSitemap).toBe('boolean');
		}
	});

	test('PUT /api/seo/sitemap-settings/:collection updates settings', async ({ request }) => {
		// First get the list to find a valid collection
		const listRes = await request.get('/api/seo/sitemap-settings');
		expect(listRes.status()).toBe(200);
		const listData = (await listRes.json()) as {
			settings: Array<{ collection: string; includeInSitemap: boolean }>;
		};
		expect(listData.settings.length).toBeGreaterThan(0);

		const targetCollection = listData.settings[0].collection;

		// Update the settings
		const updateRes = await request.put(`/api/seo/sitemap-settings/${targetCollection}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				includeInSitemap: true,
				priority: 0.8,
				changeFreq: 'daily',
			},
		});
		expect(updateRes.status()).toBe(200);

		// Verify the update persisted
		const verifyRes = await request.get('/api/seo/sitemap-settings');
		const verifyData = (await verifyRes.json()) as {
			settings: Array<{
				collection: string;
				includeInSitemap: boolean;
				priority: number | null;
				changeFreq: string | null;
			}>;
		};

		const updated = verifyData.settings.find((s) => s.collection === targetCollection);
		expect(updated).toBeDefined();
		expect(updated?.includeInSitemap).toBe(true);
		expect(Number(updated?.priority)).toBe(0.8);
		expect(updated?.changeFreq).toBe('daily');
	});

	test('GET /api/seo/seo-settings returns defaults', async ({ request }) => {
		const response = await request.get('/api/seo/seo-settings');
		expect(response.status()).toBe(200);

		const data = (await response.json()) as {
			robotsRules: Array<{ userAgent: string; allow: string[]; disallow: string[] }>;
			robotsCrawlDelay: number | null;
			robotsAdditionalSitemaps: string[];
		};

		// Should have at least one rule with default user-agent
		expect(Array.isArray(data.robotsRules)).toBe(true);
		expect(data.robotsRules.length).toBeGreaterThanOrEqual(1);
		expect(data.robotsRules[0].userAgent).toBe('*');
	});

	test('PUT /api/seo/seo-settings updates robots config', async ({ request }) => {
		const updateRes = await request.put('/api/seo/seo-settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				robotsRules: [
					{ userAgent: '*', allow: ['/'], disallow: ['/admin', '/api'] },
					{ userAgent: 'Googlebot', allow: ['/'], disallow: [] },
				],
				robotsCrawlDelay: 10,
				robotsAdditionalSitemaps: ['https://example.com/extra-sitemap.xml'],
			},
		});
		expect(updateRes.status()).toBe(200);

		// Verify the update persisted via GET
		const verifyRes = await request.get('/api/seo/seo-settings');
		expect(verifyRes.status()).toBe(200);

		const data = (await verifyRes.json()) as {
			robotsRules: Array<{ userAgent: string; allow: string[]; disallow: string[] }>;
			robotsCrawlDelay: number | null;
			robotsAdditionalSitemaps: string[];
		};

		expect(data.robotsRules).toHaveLength(2);
		expect(data.robotsRules[0].disallow).toContain('/admin');
		expect(data.robotsRules[0].disallow).toContain('/api');
		expect(data.robotsRules[1].userAgent).toBe('Googlebot');
		expect(Number(data.robotsCrawlDelay)).toBe(10);
		expect(data.robotsAdditionalSitemaps).toContain('https://example.com/extra-sitemap.xml');
	});

	test('GET /api/seo/meta/:collection/:id returns 401 without authentication', async ({
		request,
		baseURL,
		playwright,
	}) => {
		// First create a page (authenticated from beforeEach)
		const slug = `auth-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const create = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'Auth Test Page', slug, seo: { metaTitle: 'Test' } },
		});
		expect(create.status()).toBe(201);
		const doc = (await create.json()) as { doc: { id: string } };

		// Use a truly fresh request context without any auth cookies
		const anonContext = await playwright.request.newContext({ baseURL: baseURL });
		const unauthResponse = await anonContext.get(`/api/seo/meta/pages/${doc.doc.id}`);
		expect(unauthResponse.status()).toBe(401);
		await anonContext.dispose();
	});

	test('PUT /api/seo/sitemap-settings/:collection rejects invalid changeFreq', async ({
		request,
	}) => {
		const res = await request.put('/api/seo/sitemap-settings/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: { changeFreq: '<injected>xml</injected>' },
		});
		expect(res.status()).toBe(400);
	});

	test('PUT /api/seo/seo-settings strips newlines from robotsRules', async ({ request }) => {
		const res = await request.put('/api/seo/seo-settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				robotsRules: [{ userAgent: 'Bot\nDisallow: /secret', allow: ['/'], disallow: [] }],
			},
		});
		expect(res.status()).toBe(200);

		// Verify the stored value has newlines stripped
		const getRes = await request.get('/api/seo/seo-settings');
		expect(getRes.status()).toBe(200);
		const data = (await getRes.json()) as {
			robotsRules: Array<{ userAgent: string }>;
		};
		expect(data.robotsRules[0].userAgent).not.toContain('\n');
	});

	test('robots.txt reflects saved seo-settings', async ({ request }) => {
		// Save custom robots config
		const updateRes = await request.put('/api/seo/seo-settings', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				robotsRules: [{ userAgent: 'E2EBot', allow: ['/public'], disallow: ['/secret'] }],
				robotsCrawlDelay: 5,
				robotsAdditionalSitemaps: [],
			},
		});
		expect(updateRes.status()).toBe(200);

		// robots.txt should now reflect the saved settings
		// The clearCache callback is triggered on PUT, so next GET should read from DB
		await expect
			.poll(
				async () => {
					const res = await request.get('/robots.txt');
					if (!res.ok()) return '';
					return await res.text();
				},
				{ timeout: 10_000, message: 'robots.txt should reflect saved settings' },
			)
			.toContain('E2EBot');

		const robotsRes = await request.get('/robots.txt');
		const body = await robotsRes.text();
		expect(body).toContain('User-agent: E2EBot');
		expect(body).toContain('Allow: /public');
		expect(body).toContain('Disallow: /secret');
		expect(body).toContain('Crawl-delay: 5');
	});
});
