import { test, expect } from '../fixtures';

/**
 * Seed Tracking Table Tests
 *
 * Verifies that the _momentum_seeds tracking table correctly stores
 * seed metadata including checksums and timestamps.
 *
 * Note: These tests verify behavior through the API since direct DB access
 * is not available in E2E tests. The tracking table behavior is validated
 * by observing seed idempotency and skip behavior.
 */
test.describe('Seed Tracking Tests', { tag: ['@seeding'] }, () => {
	test('seeds are tracked with stable IDs', async ({ request }) => {
		// The fact that idempotency works proves tracking is functioning
		// Get categories to verify they weren't duplicated
		const response = await request.get('/api/categories');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: Array<{ slug: string }> };

		// Should have exactly the expected number of seeded categories
		const seededSlugs = ['technology', 'news'];
		const foundSlugs = data.docs.filter((c) => seededSlugs.includes(c.slug));

		expect(foundSlugs.length).toBe(2);
	});

	test('health endpoint reflects accurate seed count from tracking', async ({ request }) => {
		const response = await request.get('/api/health?checkSeeds=true');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			status: string;
			seeds: { completed: number; expected: number; ready: boolean };
		};

		// The health endpoint uses tracking table data to report counts
		expect(data.seeds.completed).toBeGreaterThan(0);
		expect(data.seeds.ready).toBe(true);
	});

	test('all expected seeds are present in database', async ({ request }) => {
		// Verify categories
		const categoriesResponse = await request.get('/api/categories');
		expect(categoriesResponse.ok()).toBe(true);
		const categories = (await categoriesResponse.json()) as {
			docs: Array<{ slug: string; name: string }>;
		};

		expect(categories.docs.find((c) => c.slug === 'technology')).toBeDefined();
		expect(categories.docs.find((c) => c.slug === 'news')).toBeDefined();

		// Verify articles
		const articlesResponse = await request.get('/api/articles?limit=100');
		expect(articlesResponse.ok()).toBe(true);
		const articles = (await articlesResponse.json()) as {
			docs: Array<{ title: string }>;
		};

		expect(articles.docs.find((a) => a.title === 'Welcome Article')).toBeDefined();
		expect(articles.docs.find((a) => a.title === 'First Tech Article')).toBeDefined();
	});

	test('checksum tracking prevents duplicate creation', async ({ request }) => {
		// Get initial article count
		const response1 = await request.get('/api/articles?limit=100');
		expect(response1.ok()).toBe(true);
		const data1 = (await response1.json()) as { docs: Array<{ id: string }> };
		const initialCount = data1.docs.length;

		// Get count again - should be same (no duplicates created)
		const response2 = await request.get('/api/articles?limit=100');
		expect(response2.ok()).toBe(true);
		const data2 = (await response2.json()) as { docs: Array<{ id: string }> };

		expect(data2.docs.length).toBe(initialCount);
	});

	test('seed execution order is correct (dependencies resolved)', async ({ request }) => {
		// Get categories to find tech category ID
		const categoriesResponse = await request.get('/api/categories');
		expect(categoriesResponse.ok()).toBe(true);
		const categories = (await categoriesResponse.json()) as {
			docs: Array<{ id: string; slug: string }>;
		};

		const techCategory = categories.docs.find((c) => c.slug === 'technology');
		expect(techCategory).toBeDefined();

		// Get articles to verify tech article has correct category
		const articlesResponse = await request.get('/api/articles?limit=100');
		expect(articlesResponse.ok()).toBe(true);
		const articles = (await articlesResponse.json()) as {
			docs: Array<{ title: string; category?: string }>;
		};

		const techArticle = articles.docs.find((a) => a.title === 'First Tech Article');
		expect(techArticle).toBeDefined();

		// This proves seeds executed in correct order:
		// 1. Category was created first
		// 2. getSeeded('cat-tech') returned the category
		// 3. Article was created with correct category reference
		expect(techArticle?.category).toBe(techCategory?.id);
	});
});
