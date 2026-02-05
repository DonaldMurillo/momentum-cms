import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './fixtures/e2e-utils';

/**
 * Relationship field E2E tests.
 * Verifies that relationship fields store document IDs correctly
 * and that CRUD operations with relationships work through the API.
 */
test.describe('Relationship field', () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	test('seeded articles have correct category relationships', async ({ request }) => {
		// Fetch articles and categories
		const [articlesResponse, categoriesResponse] = await Promise.all([
			request.get('/api/articles?limit=20'),
			request.get('/api/categories?limit=10'),
		]);
		expect(articlesResponse.ok()).toBe(true);
		expect(categoriesResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const articles = (await articlesResponse.json()) as {
			docs: Array<{ id: string; title: string; category?: string }>;
		};
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const categories = (await categoriesResponse.json()) as {
			docs: Array<{ id: string; name: string }>;
		};

		expect(articles.docs.length).toBeGreaterThan(0);
		expect(categories.docs.length).toBeGreaterThan(0);

		const techCat = categories.docs.find((d) => d.name === 'Technology');
		const newsCat = categories.docs.find((d) => d.name === 'News');
		expect(techCat, 'Technology category should exist').toBeTruthy();
		expect(newsCat, 'News category should exist').toBeTruthy();
		// Ensure IDs are real non-empty strings (prevents undefined===undefined false passes)
		expect(typeof techCat?.id).toBe('string');
		expect(techCat?.id?.length).toBeGreaterThan(0);
		expect(typeof newsCat?.id).toBe('string');
		expect(newsCat?.id?.length).toBeGreaterThan(0);

		// Tech articles should reference the Technology category
		const techArticle = articles.docs.find((d) => d.title === 'First Tech Article');
		expect(techArticle, 'First Tech Article should exist').toBeTruthy();
		expect(techArticle?.category).toBe(techCat?.id);

		const techArticle2 = articles.docs.find((d) => d.title === 'Second Tech Article');
		expect(techArticle2, 'Second Tech Article should exist').toBeTruthy();
		expect(techArticle2?.category).toBe(techCat?.id);

		// News article should reference the News category
		const newsArticle = articles.docs.find((d) => d.title === 'Breaking News');
		expect(newsArticle, 'Breaking News should exist').toBeTruthy();
		expect(newsArticle?.category).toBe(newsCat?.id);

		// Welcome article has no category set (seeded without one)
		const welcomeArticle = articles.docs.find((d) => d.title === 'Welcome Article');
		expect(welcomeArticle, 'Welcome Article should exist').toBeTruthy();
		expect(welcomeArticle?.category ?? null).toBeNull();
	});

	test('can create article with category relationship via API', async ({ request }) => {
		// Get the Sports category ID
		const catResponse = await request.get('/api/categories?limit=10');
		expect(catResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const catData = (await catResponse.json()) as {
			docs: Array<{ id: string; name: string }>;
		};
		const sportsCat = catData.docs.find((d) => d.name === 'Sports');
		expect(sportsCat, 'Sports category should exist').toBeTruthy();
		expect(typeof sportsCat?.id).toBe('string');
		expect(sportsCat?.id?.length).toBeGreaterThan(0);

		const uniqueTitle = `Relationship Test Article ${Date.now()}`;
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: uniqueTitle,
				content: 'Article to test relationship field.',
				category: sportsCat?.id,
			},
		});
		expect(createResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const createBody = (await createResponse.json()) as {
			doc: {
				id: string;
				title: string;
				category?: string;
			};
		};
		const created = createBody.doc;
		expect(created.title).toBe(uniqueTitle);
		expect(created.category).toBe(sportsCat?.id);

		// Verify persistence via GET
		const getResponse = await request.get(`/api/articles/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const getBody = (await getResponse.json()) as { doc: { category?: string } };
		expect(getBody.doc.category).toBe(sportsCat?.id);

		// Clean up
		const deleteResponse = await request.delete(`/api/articles/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/articles/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('can update article category relationship via API', async ({ request }) => {
		// Get category IDs
		const catResponse = await request.get('/api/categories?limit=10');
		expect(catResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const catData = (await catResponse.json()) as {
			docs: Array<{ id: string; name: string }>;
		};
		const techCat = catData.docs.find((d) => d.name === 'Technology');
		const newsCat = catData.docs.find((d) => d.name === 'News');
		expect(techCat, 'Technology category should exist').toBeTruthy();
		expect(newsCat, 'News category should exist').toBeTruthy();
		expect(typeof techCat?.id).toBe('string');
		expect(typeof newsCat?.id).toBe('string');
		// Ensure they are different categories
		expect(techCat?.id).not.toBe(newsCat?.id);

		// Create with tech category
		const uniqueTitle = `Update Rel Test ${Date.now()}`;
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: uniqueTitle,
				content: 'Test article for relationship update.',
				category: techCat?.id,
			},
		});
		expect(createResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const createBody = (await createResponse.json()) as { doc: { id: string; category?: string } };
		const created = createBody.doc;
		expect(created.category).toBe(techCat?.id);

		// Update to news category
		const updateResponse = await request.patch(`/api/articles/${created.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { category: newsCat?.id },
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify the update persisted
		const getResponse = await request.get(`/api/articles/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const getBody = (await getResponse.json()) as { doc: { category?: string } };
		expect(getBody.doc.category).toBe(newsCat?.id);
		// Verify old category is gone
		expect(getBody.doc.category).not.toBe(techCat?.id);

		// Clean up
		const deleteResponse = await request.delete(`/api/articles/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/articles/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('can clear relationship via API', async ({ request }) => {
		// Get a category ID
		const catResponse = await request.get('/api/categories?limit=10');
		expect(catResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const catData = (await catResponse.json()) as {
			docs: Array<{ id: string; name: string }>;
		};
		const techCat = catData.docs.find((d) => d.name === 'Technology');
		expect(techCat, 'Technology category should exist').toBeTruthy();
		expect(typeof techCat?.id).toBe('string');

		// Create with category
		const uniqueTitle = `Clear Rel Test ${Date.now()}`;
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: uniqueTitle,
				content: 'Test article for clearing relationship.',
				category: techCat?.id,
			},
		});
		expect(createResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const createBody = (await createResponse.json()) as { doc: { id: string; category?: string } };
		const created = createBody.doc;
		expect(created.category).toBe(techCat?.id);

		// Clear the relationship by setting to null
		const updateResponse = await request.patch(`/api/articles/${created.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { category: null },
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify the relationship is cleared
		const getResponse = await request.get(`/api/articles/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const getBody = (await getResponse.json()) as { doc: { category?: string | null } };
		// Use explicit null check rather than toBeFalsy() which would also pass for empty string
		expect(getBody.doc.category ?? null).toBeNull();

		// Clean up
		const deleteResponse = await request.delete(`/api/articles/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/articles/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});
});
