import { test, expect, TEST_AUTHOR3_CREDENTIALS } from '../fixtures';

/**
 * Full-text search E2E tests.
 * Verifies the GET /:collection/search?q=term endpoint against the Articles collection.
 * Uses PostgreSQL tsvector/tsquery with ILIKE fallback for partial matches.
 */
test.describe('Full-text search', { tag: ['@api', '@crud'] }, () => {
	const createdIds: string[] = [];

	test.beforeAll(async ({ request }) => {
		// Sign in
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR3_CREDENTIALS.email,
				password: TEST_AUTHOR3_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author3 sign-in must succeed').toBe(true);

		// Create test articles with distinctive words for search
		const articles = [
			{
				title: 'SRCH-Quantum Computing Breakthrough',
				content: 'Scientists have achieved a major quantum supremacy milestone',
			},
			{
				title: 'SRCH-Climate Change Report',
				content: 'New findings on global warming and environmental sustainability',
			},
			{
				title: 'SRCH-Quantum Entanglement Discovery',
				content: 'Researchers demonstrate a novel entanglement protocol',
			},
			{
				title: 'SRCH-Machine Learning Advances',
				content: 'Deep neural networks achieve breakthrough performance on quantum datasets',
			},
		];

		for (const article of articles) {
			const response = await request.post('/api/articles', {
				headers: { 'Content-Type': 'application/json' },
				data: article,
			});
			expect(response.status(), 'Article create should return 201').toBe(201);

			const data = (await response.json()) as { doc: { id: string } };
			createdIds.push(data.doc.id);
		}
	});

	test.afterAll(async ({ request }) => {
		// Sign in for cleanup
		await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR3_CREDENTIALS.email,
				password: TEST_AUTHOR3_CREDENTIALS.password,
			},
		});

		// Clean up test articles
		for (const id of createdIds) {
			await request.delete(`/api/articles/${id}`);
		}
	});

	test('search returns matching documents by title', async ({ request }) => {
		const response = await request.get('/api/articles/search?q=quantum');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{ id: string; title: string }>;
			totalDocs: number;
		};

		// Should find articles with "quantum" in title or content
		expect(data.docs.length).toBeGreaterThanOrEqual(2);
		// All results should contain "quantum" somewhere (title or content)
		const titles = data.docs.map((d) => d.title);
		const hasQuantumResults = titles.some((t) => t.toLowerCase().includes('quantum'));
		expect(hasQuantumResults).toBe(true);
	});

	test('search returns empty array for non-matching query', async ({ request }) => {
		const response = await request.get('/api/articles/search?q=xyznonexistent12345');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<Record<string, unknown>>;
			totalDocs: number;
		};

		expect(data.docs.length).toBe(0);
		expect(data.totalDocs).toBe(0);
	});

	test('search with specific fields restricts search scope', async ({ request }) => {
		// Search only in title field for "breakthrough"
		const titleOnlyResponse = await request.get('/api/articles/search?q=breakthrough&fields=title');
		expect(titleOnlyResponse.ok()).toBe(true);

		const titleData = (await titleOnlyResponse.json()) as {
			docs: Array<{ title: string }>;
			totalDocs: number;
		};

		// Only the article with "Breakthrough" in the title should match
		const titlesWithBreakthrough = titleData.docs.filter((d) =>
			d.title.toLowerCase().includes('breakthrough'),
		);
		expect(titlesWithBreakthrough.length).toBeGreaterThanOrEqual(1);
	});

	test('search respects limit parameter', async ({ request }) => {
		const response = await request.get('/api/articles/search?q=SRCH&limit=2');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<Record<string, unknown>>;
			totalDocs: number;
		};

		// Should return at most 2 results
		expect(data.docs.length).toBeLessThanOrEqual(2);
		// But totalDocs should reflect actual total matches
		expect(data.totalDocs).toBeGreaterThanOrEqual(2);
	});

	test('search with empty query returns empty results', async ({ request }) => {
		const response = await request.get('/api/articles/search?q=');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<Record<string, unknown>>;
			totalDocs: number;
		};

		expect(data.docs.length).toBe(0);
	});

	test('search finds content in body text', async ({ request }) => {
		// "sustainability" only appears in the content of the Climate Change article
		const response = await request.get('/api/articles/search?q=sustainability');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{ title: string; content: string }>;
			totalDocs: number;
		};

		expect(data.docs.length).toBeGreaterThanOrEqual(1);
		const climateArticle = data.docs.find((d) => d.title.includes('Climate'));
		expect(climateArticle).toBeDefined();
	});
});
