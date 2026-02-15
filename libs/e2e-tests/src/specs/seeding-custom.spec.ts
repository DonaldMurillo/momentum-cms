import { test, expect } from '../fixtures';

/**
 * Custom Seed Function Tests
 *
 * Verifies that the custom seed function works correctly with getSeeded()
 * for dependency resolution and relationship seeding.
 */
test.describe('Custom Seed Function Tests', () => {
	test('custom seed function creates article with category relationship', async ({ request }) => {
		// Get the tech article created by custom seed function
		const articlesResponse = await request.get('/api/articles?limit=100');
		expect(articlesResponse.ok()).toBe(true);

		const articlesData = (await articlesResponse.json()) as {
			docs: Array<{ title: string; content?: string; category?: string }>;
		};

		const techArticle = articlesData.docs.find((a) => a.title === 'First Tech Article');
		expect(techArticle).toBeDefined();
		expect(techArticle?.content).toContain('technology');
		expect(techArticle?.category).toBeDefined();
	});

	test('getSeeded() correctly resolves category dependency', async ({ request }) => {
		// Get the tech category
		const categoriesResponse = await request.get('/api/categories');
		expect(categoriesResponse.ok()).toBe(true);

		const categoriesData = (await categoriesResponse.json()) as {
			docs: Array<{ id: string; slug: string }>;
		};

		const techCategory = categoriesData.docs.find((c) => c.slug === 'technology');
		expect(techCategory).toBeDefined();

		// Get the tech article and verify its category matches
		const articlesResponse = await request.get('/api/articles?limit=100');
		expect(articlesResponse.ok()).toBe(true);

		const articlesData = (await articlesResponse.json()) as {
			docs: Array<{ title: string; category?: string }>;
		};

		const techArticle = articlesData.docs.find((a) => a.title === 'First Tech Article');
		expect(techArticle).toBeDefined();
		expect(techArticle?.category).toBe(techCategory?.id);
	});

	test('default seeds and custom seeds coexist', async ({ request }) => {
		const articlesResponse = await request.get('/api/articles?limit=100');
		expect(articlesResponse.ok()).toBe(true);

		const articlesData = (await articlesResponse.json()) as {
			docs: Array<{ title: string }>;
		};

		// Should have both default and custom seeds
		const welcomeArticle = articlesData.docs.find((a) => a.title === 'Welcome Article');
		const techArticle = articlesData.docs.find((a) => a.title === 'First Tech Article');

		expect(welcomeArticle).toBeDefined();
		expect(techArticle).toBeDefined();
	});

	test('relationship data is properly populated', async ({ request }) => {
		// Query article with category populated (if API supports it)
		const articlesResponse = await request.get('/api/articles?limit=100');
		expect(articlesResponse.ok()).toBe(true);

		const articlesData = (await articlesResponse.json()) as {
			docs: Array<{ title: string; category?: string }>;
		};

		const techArticle = articlesData.docs.find((a) => a.title === 'First Tech Article');
		expect(techArticle).toBeDefined();

		// Category should be a valid ID (not null/undefined)
		expect(techArticle?.category).toBeTruthy();
		expect(typeof techArticle?.category).toBe('string');
		expect(techArticle?.category?.length).toBeGreaterThan(0);
	});
});
