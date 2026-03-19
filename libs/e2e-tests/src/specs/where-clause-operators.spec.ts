import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Where Clause Operators E2E Tests
 *
 * Validates all where clause operators against a real PostgreSQL database
 * via the REST API. Covers text, number, date, and relationship fields
 * across all supported operators: equals, not_equals, gt, gte, lt, lte,
 * like, contains, in, not_in, exists.
 */

// Helpers
const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface DocResponse {
	doc: { id: string; [key: string]: unknown };
}

interface FindResponse {
	docs: Array<{ id: string; [key: string]: unknown }>;
	totalDocs: number;
	totalPages: number;
	page: number;
	limit: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

function whereQuery(where: Record<string, unknown>): string {
	return `where=${encodeURIComponent(JSON.stringify(where))}`;
}

test.describe('Where clause operators', { tag: ['@where', '@api'] }, () => {
	// ============================================
	// Shared test data IDs for cleanup
	// ============================================
	const categoryIds: string[] = [];
	const productIds: string[] = [];
	const eventIds: string[] = [];

	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: JSON_HEADERS,
			data: {
				email: TEST_CREDENTIALS.email,
				password: TEST_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Admin sign-in must succeed').toBe(true);
	});

	// ============================================
	// A. Text field operators (categories collection)
	// ============================================
	test.describe('text field operators', () => {
		test.beforeAll(async ({ request }) => {
			// Sign in
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			// Create test categories
			const names = ['Technology', 'Science', 'Arts & Culture', 'Sports', 'Health & Wellness'];
			for (const name of names) {
				const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
				const res = await request.post('/api/categories', {
					headers: JSON_HEADERS,
					data: { name, slug: `where-test-${slug}` },
				});
				expect(res.status(), `Creating category "${name}"`).toBe(201);
				const body = (await res.json()) as DocResponse;
				categoryIds.push(body.doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of categoryIds) {
				await request.delete(`/api/categories/${id}`);
			}
			categoryIds.length = 0;
		});

		test('equals — exact match on name', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { equals: 'Technology' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] === 'Technology')).toBe(true);
		});

		test('equals shorthand — plain value', async ({ request }) => {
			const res = await request.get(`/api/categories?${whereQuery({ name: 'Science' })}&limit=100`);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] === 'Science')).toBe(true);
		});

		test('not_equals — exclude specific name', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { not_equals: 'Technology' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] !== 'Technology')).toBe(true);
		});

		test('like — SQL pattern matching', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { like: '%ence' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			// Should match "Science"
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.some((d) => d['name'] === 'Science')).toBe(true);
		});

		test('contains — case-insensitive substring match', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { contains: 'tech' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.some((d) => d['name'] === 'Technology')).toBe(true);
		});

		test('in — match any of multiple values', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { in: ['Technology', 'Sports'] } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(2);
			const names = body.docs.map((d) => d['name']);
			expect(names).toContain('Technology');
			expect(names).toContain('Sports');
		});

		test('not_in — exclude set of values', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { not_in: ['Technology', 'Sports'] } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] !== 'Technology' && d['name'] !== 'Sports')).toBe(
				true,
			);
		});

		test('exists: true — field is not null', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { exists: true } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] != null)).toBe(true);
		});
	});

	// ============================================
	// B. Number field operators (products collection)
	// ============================================
	test.describe('number field operators', () => {
		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			const products = [
				{ name: 'Where Widget A', price: 10 },
				{ name: 'Where Widget B', price: 25 },
				{ name: 'Where Gadget C', price: 50 },
				{ name: 'Where Gadget D', price: 75 },
				{ name: 'Where Premium E', price: 100 },
			];
			for (const product of products) {
				const res = await request.post('/api/products', {
					headers: JSON_HEADERS,
					data: product,
				});
				expect(res.status(), `Creating product "${product.name}"`).toBe(201);
				const body = (await res.json()) as DocResponse;
				productIds.push(body.doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of productIds) {
				await request.delete(`/api/products/${id}`);
			}
			productIds.length = 0;
		});

		test('gt — price greater than 50', async ({ request }) => {
			const res = await request.get(`/api/products?${whereQuery({ price: { gt: 50 } })}&limit=100`);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(2);
			expect(body.docs.every((d) => Number(d['price']) > 50)).toBe(true);
		});

		test('gte — price greater than or equal to 50', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({ price: { gte: 50 } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(3);
			expect(body.docs.every((d) => Number(d['price']) >= 50)).toBe(true);
		});

		test('lt — price less than 50', async ({ request }) => {
			const res = await request.get(`/api/products?${whereQuery({ price: { lt: 50 } })}&limit=100`);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(2);
			expect(body.docs.every((d) => Number(d['price']) < 50)).toBe(true);
		});

		test('lte — price less than or equal to 50', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({ price: { lte: 50 } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(3);
			expect(body.docs.every((d) => Number(d['price']) <= 50)).toBe(true);
		});

		test('range — price between 25 and 75 (inclusive)', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({ price: { gte: 25, lte: 75 } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(3);
			expect(body.docs.every((d) => Number(d['price']) >= 25 && Number(d['price']) <= 75)).toBe(
				true,
			);
		});

		test('not_equals — exclude specific price', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({ price: { not_equals: 50 } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.every((d) => Number(d['price']) !== 50)).toBe(true);
		});

		test('in — match set of prices', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({ price: { in: [10, 100] } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(2);
			expect(body.docs.every((d) => [10, 100].includes(Number(d['price'])))).toBe(true);
		});
	});

	// ============================================
	// C. Date field operators (events collection)
	// ============================================
	test.describe('date field operators', () => {
		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			const events = [
				{ title: 'Where Past Event', eventDate: '2024-01-15T10:00:00Z' },
				{ title: 'Where Mid Event', eventDate: '2025-06-15T10:00:00Z' },
				{ title: 'Where Future Event', eventDate: '2027-12-01T10:00:00Z' },
				{ title: 'Where No Date Event' }, // no eventDate
			];
			for (const event of events) {
				const res = await request.post('/api/events', {
					headers: JSON_HEADERS,
					data: event,
				});
				expect(res.status(), `Creating event "${event.title}"`).toBe(201);
				const body = (await res.json()) as DocResponse;
				eventIds.push(body.doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of eventIds) {
				await request.delete(`/api/events/${id}`);
			}
			eventIds.length = 0;
		});

		test('gt — events after 2025-01-01', async ({ request }) => {
			const res = await request.get(
				`/api/events?${whereQuery({ eventDate: { gt: '2025-01-01T00:00:00Z' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(2);
			expect(body.docs.every((d) => String(d['eventDate']) > '2025-01-01')).toBe(true);
		});

		test('lt — events before 2026-01-01', async ({ request }) => {
			const res = await request.get(
				`/api/events?${whereQuery({ eventDate: { lt: '2026-01-01T00:00:00Z' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(2);
		});

		test('range — events within 2025', async ({ request }) => {
			const res = await request.get(
				`/api/events?${whereQuery({ eventDate: { gte: '2025-01-01T00:00:00Z', lte: '2025-12-31T23:59:59Z' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.some((d) => d['title'] === 'Where Mid Event')).toBe(true);
		});

		test('exists: true — events with a date', async ({ request }) => {
			const res = await request.get(
				`/api/events?${whereQuery({ eventDate: { exists: true } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.every((d) => d['eventDate'] != null)).toBe(true);
			// "Where No Date Event" should NOT appear
			expect(body.docs.every((d) => d['title'] !== 'Where No Date Event')).toBe(true);
		});

		test('exists: false — events without a date', async ({ request }) => {
			const res = await request.get(
				`/api/events?${whereQuery({ eventDate: { exists: false } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.some((d) => d['title'] === 'Where No Date Event')).toBe(true);
		});
	});

	// ============================================
	// D. Relationship field filtering (articles → categories)
	// ============================================
	test.describe('relationship field filtering', () => {
		const relCatIds: string[] = [];
		const relArtIds: string[] = [];

		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			// Create 2 categories
			for (const name of ['Where Cat Alpha', 'Where Cat Beta']) {
				const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
				const res = await request.post('/api/categories', {
					headers: JSON_HEADERS,
					data: { name, slug },
				});
				expect(res.status()).toBe(201);
				relCatIds.push(((await res.json()) as DocResponse).doc.id);
			}

			// Create articles: 2 in Alpha, 1 in Beta, 1 with no category
			const articles = [
				{ title: 'Where Alpha Article 1', content: 'Test', category: relCatIds[0] },
				{ title: 'Where Alpha Article 2', content: 'Test', category: relCatIds[0] },
				{ title: 'Where Beta Article', content: 'Test', category: relCatIds[1] },
				{ title: 'Where Orphan Article', content: 'Test' },
			];
			for (const art of articles) {
				const res = await request.post('/api/articles', {
					headers: JSON_HEADERS,
					data: art,
				});
				expect(res.status()).toBe(201);
				relArtIds.push(((await res.json()) as DocResponse).doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of relArtIds) {
				await request.delete(`/api/articles/${id}`);
			}
			for (const id of relCatIds) {
				await request.delete(`/api/categories/${id}`);
			}
			relArtIds.length = 0;
			relCatIds.length = 0;
		});

		test('equals — filter by category ID', async ({ request }) => {
			const res = await request.get(
				`/api/articles?${whereQuery({ category: { equals: relCatIds[0] } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBe(2);
			expect(
				body.docs.every(
					(d) =>
						d['category'] === relCatIds[0] ||
						(d['category'] as { id: string })?.id === relCatIds[0],
				),
			).toBe(true);
		});

		test('in — filter by multiple category IDs', async ({ request }) => {
			const res = await request.get(
				`/api/articles?${whereQuery({ category: { in: relCatIds } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBe(3);
		});

		test('not_equals — exclude one category', async ({ request }) => {
			const res = await request.get(
				`/api/articles?${whereQuery({ category: { not_equals: relCatIds[0] } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			// Should include Beta + Orphan (null category != Alpha)
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(
				body.docs.every((d) => {
					const cat = d['category'];
					const catId = typeof cat === 'object' && cat !== null ? (cat as { id: string }).id : cat;
					return catId !== relCatIds[0];
				}),
			).toBe(true);
		});

		test('exists: false — articles with no category', async ({ request }) => {
			const res = await request.get(
				`/api/articles?${whereQuery({ category: { exists: false } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.some((d) => d['title'] === 'Where Orphan Article')).toBe(true);
		});

		test('exists: true — articles with a category', async ({ request }) => {
			const res = await request.get(
				`/api/articles?${whereQuery({ category: { exists: true } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['category'] != null)).toBe(true);
			expect(body.docs.every((d) => d['title'] !== 'Where Orphan Article')).toBe(true);
		});

		test('combined — category equals + title contains', async ({ request }) => {
			const res = await request.get(
				`/api/articles?${whereQuery({
					category: { equals: relCatIds[0] },
					title: { contains: 'Article 1' },
				})}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBe(1);
			expect(body.docs[0]['title']).toBe('Where Alpha Article 1');
		});
	});

	// ============================================
	// E. Combined / compound filters
	// ============================================
	test.describe('compound filters', () => {
		const compProductIds: string[] = [];

		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			const products = [
				{ name: 'Where Cheap Widget', price: 5 },
				{ name: 'Where Mid Widget', price: 30 },
				{ name: 'Where Expensive Gadget', price: 200 },
				{ name: 'Where Mid Gadget', price: 45 },
			];
			for (const p of products) {
				const res = await request.post('/api/products', {
					headers: JSON_HEADERS,
					data: p,
				});
				expect(res.status()).toBe(201);
				compProductIds.push(((await res.json()) as DocResponse).doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of compProductIds) {
				await request.delete(`/api/products/${id}`);
			}
			compProductIds.length = 0;
		});

		test('price gte + name contains', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({
					price: { gte: 10 },
					name: { contains: 'widget' },
				})}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(
				body.docs.every(
					(d) => Number(d['price']) >= 10 && String(d['name']).toLowerCase().includes('widget'),
				),
			).toBe(true);
		});

		test('price range + name not_equals', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({
					price: { gte: 5, lte: 50 },
					name: { not_equals: 'Where Cheap Widget' },
				})}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] !== 'Where Cheap Widget')).toBe(true);
			expect(body.docs.every((d) => Number(d['price']) >= 5 && Number(d['price']) <= 50)).toBe(
				true,
			);
		});
	});

	// ============================================
	// F. Pagination + where
	// ============================================
	test.describe('pagination with where', () => {
		const pagProductIds: string[] = [];

		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			// Create 15 products in a price range
			for (let i = 1; i <= 15; i++) {
				const res = await request.post('/api/products', {
					headers: JSON_HEADERS,
					data: { name: `Where Paginated Item ${i}`, price: i * 10 },
				});
				expect(res.status()).toBe(201);
				pagProductIds.push(((await res.json()) as DocResponse).doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of pagProductIds) {
				await request.delete(`/api/products/${id}`);
			}
			pagProductIds.length = 0;
		});

		test('filtered results respect pagination metadata', async ({ request }) => {
			// Filter: price between 30 and 120 (items 3-12 = 10 items)
			const res = await request.get(
				`/api/products?${whereQuery({
					price: { gte: 30, lte: 120 },
					name: { contains: 'Paginated' },
				})}&limit=5&page=1`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs).toHaveLength(5);
			expect(body.totalDocs).toBe(10);
			expect(body.totalPages).toBe(2);
			expect(body.hasNextPage).toBe(true);
			expect(body.page).toBe(1);
		});

		test('second page of filtered results', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({
					price: { gte: 30, lte: 120 },
					name: { contains: 'Paginated' },
				})}&limit=5&page=2`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs).toHaveLength(5);
			expect(body.hasPrevPage).toBe(true);
			expect(body.page).toBe(2);
		});
	});

	// ============================================
	// G. Edge cases (self-contained — creates own data)
	// ============================================
	test.describe('edge cases', () => {
		const edgeCatIds: string[] = [];

		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const name of ['Edge Alpha', 'Edge Beta', 'Edge Gamma']) {
				const slug = name.toLowerCase().replace(/\s+/g, '-');
				const res = await request.post('/api/categories', {
					headers: JSON_HEADERS,
					data: { name, slug: `where-edge-${slug}` },
				});
				expect(res.status()).toBe(201);
				edgeCatIds.push(((await res.json()) as DocResponse).doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of edgeCatIds) {
				await request.delete(`/api/categories/${id}`);
			}
			edgeCatIds.length = 0;
		});

		test('not_in with single element', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { not_in: ['Edge Alpha'] } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] !== 'Edge Alpha')).toBe(true);
		});

		test('contains with empty string matches all', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { contains: '' } })}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			// Empty contains wraps to ILIKE '%%' which matches everything
			expect(body.docs.length).toBeGreaterThanOrEqual(3);
		});

		test('multiple operators on different fields', async ({ request }) => {
			// Create a product to ensure at least one result
			const createRes = await request.post('/api/products', {
				headers: JSON_HEADERS,
				data: { name: 'Where Edge Case Product', price: 42 },
			});
			expect(createRes.status()).toBe(201);
			const productId = ((await createRes.json()) as DocResponse).doc.id;

			const res = await request.get(
				`/api/products?${whereQuery({
					name: { contains: 'Edge Case' },
					price: { equals: 42 },
				})}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.some((d) => d['name'] === 'Where Edge Case Product')).toBe(true);

			// Cleanup
			await request.delete(`/api/products/${productId}`);
		});
	});

	// ============================================
	// H. URL query string formats (self-contained)
	// ============================================
	test.describe('URL query string formats', () => {
		const urlCatIds: string[] = [];

		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			const res = await request.post('/api/categories', {
				headers: JSON_HEADERS,
				data: { name: 'TechURL', slug: 'where-url-tech' },
			});
			expect(res.status()).toBe(201);
			urlCatIds.push(((await res.json()) as DocResponse).doc.id);
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of urlCatIds) {
				await request.delete(`/api/categories/${id}`);
			}
			urlCatIds.length = 0;
		});

		test('JSON format in query string', async ({ request }) => {
			const res = await request.get(
				`/api/categories?where=${encodeURIComponent('{"name":{"contains":"TechURL"}}')}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.some((d) => d['name'] === 'TechURL')).toBe(true);
		});

		test('nested query string format (Express qs)', async ({ request }) => {
			const res = await request.get('/api/categories?where[name][contains]=TechURL&limit=100');
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.some((d) => d['name'] === 'TechURL')).toBe(true);
		});
	});

	// ============================================
	// I. Sort parameter
	// ============================================
	test.describe('sort parameter', () => {
		const sortProductIds: string[] = [];

		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			const products = [
				{ name: 'Sort Alpha', price: 30 },
				{ name: 'Sort Beta', price: 10 },
				{ name: 'Sort Gamma', price: 50 },
			];
			for (const p of products) {
				const res = await request.post('/api/products', {
					headers: JSON_HEADERS,
					data: p,
				});
				expect(res.status()).toBe(201);
				sortProductIds.push(((await res.json()) as DocResponse).doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of sortProductIds) {
				await request.delete(`/api/products/${id}`);
			}
			sortProductIds.length = 0;
		});

		test('sort ascending by name', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({ name: { contains: 'Sort' } })}&sort=name&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(3);
			const names = body.docs
				.filter((d) => String(d['name']).startsWith('Sort'))
				.map((d) => d['name']);
			expect(names).toEqual([...names].sort());
		});

		test('sort descending by price', async ({ request }) => {
			const res = await request.get(
				`/api/products?${whereQuery({ name: { contains: 'Sort' } })}&sort=-price&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			const prices = body.docs
				.filter((d) => String(d['name']).startsWith('Sort'))
				.map((d) => Number(d['price']));
			// Prices should be in descending order
			for (let i = 1; i < prices.length; i++) {
				expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
			}
		});
	});

	// ============================================
	// J. OR/AND logical operators
	// ============================================
	test.describe('OR/AND logical operators', () => {
		const orAndCatIds: string[] = [];

		test.beforeAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});

			for (const name of ['OrAnd Red', 'OrAnd Blue', 'OrAnd Green']) {
				const slug = name.toLowerCase().replace(/\s+/g, '-');
				const res = await request.post('/api/categories', {
					headers: JSON_HEADERS,
					data: { name, slug: `where-orand-${slug}` },
				});
				expect(res.status()).toBe(201);
				orAndCatIds.push(((await res.json()) as DocResponse).doc.id);
			}
		});

		test.afterAll(async ({ request }) => {
			await request.post('/api/auth/sign-in/email', {
				headers: JSON_HEADERS,
				data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
			});
			for (const id of orAndCatIds) {
				await request.delete(`/api/categories/${id}`);
			}
			orAndCatIds.length = 0;
		});

		test('or — match either of two names', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({
					or: [{ name: { equals: 'OrAnd Red' } }, { name: { equals: 'OrAnd Blue' } }],
				})}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(2);
			const names = body.docs.map((d) => d['name']);
			expect(names).toContain('OrAnd Red');
			expect(names).toContain('OrAnd Blue');
			expect(names).not.toContain('OrAnd Green');
		});

		test('and — both conditions must match', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({
					and: [{ name: { contains: 'OrAnd' } }, { name: { contains: 'Green' } }],
				})}&limit=100`,
			);
			expect(res.ok()).toBe(true);
			const body = (await res.json()) as FindResponse;
			expect(body.docs.length).toBeGreaterThanOrEqual(1);
			expect(body.docs.every((d) => d['name'] === 'OrAnd Green')).toBe(true);
		});
	});

	// ============================================
	// K. Security limits
	// ============================================
	test.describe('security limits', () => {
		test('reject unknown operators', async ({ request }) => {
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { bogus: 'value' } })}&limit=10`,
			);
			// Should return an error status (400 or 500)
			expect(res.ok()).toBe(false);
		});

		test('reject oversized in array', async ({ request }) => {
			const bigArray = Array.from({ length: 501 }, (_, i) => `id-${i}`);
			const res = await request.get(
				`/api/categories?${whereQuery({ name: { in: bigArray } })}&limit=10`,
			);
			expect(res.ok()).toBe(false);
		});
	});
});
