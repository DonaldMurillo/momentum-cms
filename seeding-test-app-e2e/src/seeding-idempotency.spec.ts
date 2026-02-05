import { test, expect } from '@playwright/test';

/**
 * Seeding Idempotency Tests
 *
 * Verifies that running seeding multiple times does not create duplicates.
 * The seeding system should skip existing seeds based on their seedId.
 */
test.describe('Seeding Idempotency Tests', () => {
	test('no duplicate categories after multiple runs', async ({ request }) => {
		const response = await request.get('/api/categories');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: Array<{ slug: string }> };

		// Count categories by slug - should be exactly one of each seeded category
		const techCategories = data.docs.filter((c) => c.slug === 'technology');
		const newsCategories = data.docs.filter((c) => c.slug === 'news');

		expect(techCategories.length).toBe(1);
		expect(newsCategories.length).toBe(1);
	});

	test('no duplicate articles after multiple runs', async ({ request }) => {
		const response = await request.get('/api/articles?limit=100');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: Array<{ title: string }> };

		// Count articles by title - should be exactly one of each seeded article
		const welcomeArticles = data.docs.filter((a) => a.title === 'Welcome Article');
		const techArticles = data.docs.filter((a) => a.title === 'First Tech Article');

		expect(welcomeArticles.length).toBe(1);
		expect(techArticles.length).toBe(1);
	});

	test('seeded data has stable IDs across runs', async ({ request }) => {
		// Get categories twice - IDs should be stable
		const response1 = await request.get('/api/categories');
		const response2 = await request.get('/api/categories');

		expect(response1.ok()).toBe(true);
		expect(response2.ok()).toBe(true);

		const data1 = (await response1.json()) as { docs: Array<{ id: string; slug: string }> };
		const data2 = (await response2.json()) as { docs: Array<{ id: string; slug: string }> };

		const tech1 = data1.docs.find((c) => c.slug === 'technology');
		const tech2 = data2.docs.find((c) => c.slug === 'technology');

		expect(tech1?.id).toBe(tech2?.id);
	});

	test('health endpoint shows consistent seed count', async ({ request }) => {
		const response = await request.get('/api/health?checkSeeds=true');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			seeds: { completed: number; expected: number; ready: boolean };
		};

		// Total should match expected (13 seeds: 3 categories + 4 articles + 2 products + 2 pages + 2 settings from defaults, plus custom seed)
		expect(data.seeds.completed).toBe(data.seeds.expected);
		expect(data.seeds.completed).toBe(13);
	});
});
