import { test, expect } from './fixtures';

/**
 * Basic Seeding Tests
 *
 * Verifies that seeded data is accessible via the API and relationships work correctly.
 */
test.describe('Seeding Basic Tests', () => {
	test('seeded categories are accessible via API', async ({ request }) => {
		const response = await request.get('/api/categories');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as { docs: Array<{ name: string; slug: string }> };
		expect(data.docs).toBeDefined();
		expect(data.docs.length).toBeGreaterThanOrEqual(2);

		// Verify seeded category data
		const techCategory = data.docs.find((c) => c.slug === 'technology');
		const newsCategory = data.docs.find((c) => c.slug === 'news');

		expect(techCategory).toBeDefined();
		expect(techCategory?.name).toBe('Technology');

		expect(newsCategory).toBeDefined();
		expect(newsCategory?.name).toBe('News');
	});

	test('seeded articles are accessible via API', async ({ request }) => {
		// Use high limit to ensure seeded articles appear even if leftover test articles exist
		const response = await request.get('/api/articles?limit=100');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{ title: string; content?: string; category?: string }>;
		};
		expect(data.docs).toBeDefined();
		expect(data.docs.length).toBeGreaterThanOrEqual(1);

		// Verify seeded article data (content is stored as HTML from richText field)
		const welcomeArticle = data.docs.find((a) => a.title === 'Welcome Article');
		expect(welcomeArticle).toBeDefined();
		expect(welcomeArticle?.content).toContain('welcome article');
	});

	test('health endpoint reports seeding completed', async ({ request }) => {
		const response = await request.get('/api/health?checkSeeds=true');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			status: string;
			seeds: { completed: number; expected: number; ready: boolean };
		};

		expect(data.status).toBe('ok');
		expect(data.seeds.ready).toBe(true);
		expect(data.seeds.completed).toBeGreaterThan(0);
	});
});
