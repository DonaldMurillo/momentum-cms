import { test, expect, TEST_CREDENTIALS } from './fixtures';

/**
 * Relationship Depth Population E2E Tests
 *
 * Tests the ?depth=N query parameter for populating relationships
 * with full document data instead of raw IDs.
 *
 * Uses the articles collection which has a `category` relationship field.
 * Seeded data includes articles with category references.
 */
test.describe('Relationship depth population', () => {
	test.beforeEach(async ({ request }) => {
		// Sign in as admin
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test.describe('Default behavior (no depth)', () => {
		test('relationships return raw IDs by default', async ({ request }) => {
			const response = await request.get('/api/articles?limit=20');
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{ title: string; category?: string | Record<string, unknown> }>;
			};

			// Find an article with a category relationship
			const techArticle = body.docs.find((d) => d.title === 'First Tech Article');
			expect(techArticle, 'First Tech Article should exist').toBeDefined();
			expect(techArticle?.category, 'category should be set').toBeDefined();

			// By default (no depth), category should be a raw ID string
			expect(typeof techArticle?.category, 'Without depth, category should be a string ID').toBe(
				'string',
			);
		});

		test('depth=0 explicit also returns raw IDs', async ({ request }) => {
			const response = await request.get('/api/articles?limit=20&depth=0');
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{ title: string; category?: string | Record<string, unknown> }>;
			};

			const techArticle = body.docs.find((d) => d.title === 'First Tech Article');
			expect(techArticle?.category, 'category should be set').toBeDefined();
			expect(typeof techArticle?.category, 'With depth=0, category should be a string ID').toBe(
				'string',
			);
		});
	});

	test.describe('depth=1 population', () => {
		test('find populates immediate relationships with depth=1', async ({ request }) => {
			const response = await request.get('/api/articles?limit=20&depth=1');
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{
					title: string;
					category?: string | { id: string; name: string; slug: string };
				}>;
			};

			const techArticle = body.docs.find((d) => d.title === 'First Tech Article');
			expect(techArticle, 'First Tech Article should exist').toBeDefined();
			expect(techArticle?.category, 'category should be populated').toBeDefined();

			// With depth=1, category should be an object with full document data
			expect(typeof techArticle?.category, 'With depth=1, category should be an object').toBe(
				'object',
			);

			const category = techArticle?.category as { id: string; name: string; slug: string };
			expect(category.name).toBe('Technology');
			expect(category.slug).toBe('technology');
			expect(typeof category.id).toBe('string');
			expect(category.id.length).toBeGreaterThan(0);
		});

		test('findById populates relationships with depth=1', async ({ request }) => {
			// First get the article ID
			const listResponse = await request.get('/api/articles?limit=20');
			const listBody = (await listResponse.json()) as {
				docs: Array<{ id: string; title: string }>;
			};
			const techArticle = listBody.docs.find((d) => d.title === 'First Tech Article');
			expect(techArticle, 'First Tech Article should exist').toBeDefined();

			// Now fetch by ID with depth=1
			const response = await request.get(`/api/articles/${techArticle?.id}?depth=1`);
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				doc: {
					title: string;
					category?: string | { id: string; name: string };
				};
			};

			expect(typeof body.doc.category, 'category should be populated as object').toBe('object');

			const category = body.doc.category as { id: string; name: string };
			expect(category.name).toBe('Technology');
		});
	});

	test.describe('Null relationships', () => {
		test('null relationship stays null with depth=1', async ({ request }) => {
			const response = await request.get('/api/articles?limit=20&depth=1');
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{
					title: string;
					category?: string | Record<string, unknown> | null;
				}>;
			};

			// Welcome article was seeded without a category
			const welcomeArticle = body.docs.find((d) => d.title === 'Welcome Article');
			expect(welcomeArticle, 'Welcome Article should exist').toBeDefined();
			expect(
				welcomeArticle?.category ?? null,
				'Null relationship should stay null with depth=1',
			).toBeNull();
		});
	});

	test.describe('Nullified relationships with depth', () => {
		test('depth=1 returns null for nullified relationship (not stale object)', async ({
			request,
		}) => {
			// Create a category and article referencing it
			const catResponse = await request.post('/api/categories', {
				headers: { 'Content-Type': 'application/json' },
				data: { name: 'Depth Null Cat', slug: 'depth-null' },
			});
			expect(catResponse.status()).toBe(201);
			const catId = ((await catResponse.json()) as { doc: { id: string } }).doc.id;

			const artResponse = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: { title: 'Depth Null Article', content: 'Test', category: catId },
			});
			expect(artResponse.status()).toBe(201);
			const artId = ((await artResponse.json()) as { doc: { id: string } }).doc.id;

			// Delete the category — FK ON DELETE SET NULL nullifies the reference
			const deleteResponse = await request.delete(`/api/categories/${catId}`);
			expect(deleteResponse.ok()).toBe(true);

			// With depth=1, category should be null (not a stale populated object)
			const getResponse = await request.get(`/api/articles/${artId}?depth=1`);
			expect(getResponse.ok()).toBe(true);
			const getBody = (await getResponse.json()) as {
				doc: { category: string | Record<string, unknown> | null };
			};
			expect(getBody.doc.category).toBeNull();

			// Clean up
			await request.delete(`/api/articles/${artId}`);
		});
	});

	test.describe('Multiple articles with different categories', () => {
		test('depth=1 correctly populates different categories per article', async ({ request }) => {
			const response = await request.get('/api/articles?limit=20&depth=1');
			expect(response.ok()).toBe(true);

			const body = (await response.json()) as {
				docs: Array<{
					title: string;
					category?: null | { id: string; name: string };
				}>;
			};

			const techArticle = body.docs.find((d) => d.title === 'First Tech Article');
			const newsArticle = body.docs.find((d) => d.title === 'Breaking News');

			expect(techArticle?.category, 'Tech article should have populated category').toBeDefined();
			expect(newsArticle?.category, 'News article should have populated category').toBeDefined();

			// Different articles should have different categories
			expect((techArticle?.category as { name: string }).name).toBe('Technology');
			expect((newsArticle?.category as { name: string }).name).toBe('News');
		});
	});
});
