import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Blocks field renderer E2E tests.
 * Verifies that blocks fields store data as arrays of typed block objects
 * and that CRUD operations on blocks work correctly.
 */
test.describe('Blocks field renderer', { tag: ['@field', '@blocks'] }, () => {
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

	test('seeded home page has blocks field data via API', async ({ request }) => {
		const response = await request.get('/api/pages?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{
				id: string;
				title: string;
				slug: string;
				content?: Array<{ blockType: string; [key: string]: unknown }>;
			}>;
		};

		const home = data.docs.find((d) => d.title === 'Home Page');
		expect(home, 'Seeded home page should exist').toBeTruthy();
		expect(home?.slug).toBe('home');

		// Verify blocks data
		expect(home?.content).toBeTruthy();
		expect(Array.isArray(home?.content)).toBe(true);
		expect(home?.content).toHaveLength(3);

		// Hero block
		expect(home?.content?.[0]?.blockType).toBe('hero');
		expect(home?.content?.[0]?.['heading']).toBe('Welcome to Our Site');
		expect(home?.content?.[0]?.['subheading']).toBe('The best place for E2E testing.');
		expect(home?.content?.[0]?.['ctaText']).toBe('Get Started');
		expect(home?.content?.[0]?.['ctaLink']).toBe('/getting-started');

		// Text block
		expect(home?.content?.[1]?.blockType).toBe('textBlock');
		expect(home?.content?.[1]?.['heading']).toBe('About Us');
		expect(home?.content?.[1]?.['body']).toBe(
			'We are a test company that exists for E2E testing purposes.',
		);

		// Feature block
		expect(home?.content?.[2]?.blockType).toBe('feature');
		expect(home?.content?.[2]?.['title']).toBe('Fast Testing');
		expect(home?.content?.[2]?.['icon']).toBe('bolt');
	});

	test('seeded about page has single block', async ({ request }) => {
		const response = await request.get('/api/pages?limit=10');
		expect(response.ok()).toBe(true);

		const data = (await response.json()) as {
			docs: Array<{
				id: string;
				title: string;
				content?: Array<{ blockType: string; [key: string]: unknown }>;
			}>;
		};

		const about = data.docs.find((d) => d.title === 'About Page');
		expect(about, 'Seeded about page should exist').toBeTruthy();
		expect(about?.content).toHaveLength(1);
		expect(about?.content?.[0]?.blockType).toBe('textBlock');
		expect(about?.content?.[0]?.['body']).toBe('Founded in testing, built for reliability.');
	});

	test('can create page with blocks via API', async ({ request }) => {
		const uniqueTitle = `Blocks Test Page ${Date.now()}`;

		const createResponse = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: uniqueTitle,
				slug: `blocks-test-${Date.now()}`,
				content: [
					{
						blockType: 'hero',
						heading: 'Test Hero',
						subheading: 'Test subheading',
						ctaText: 'Click Me',
					},
					{
						blockType: 'textBlock',
						body: 'Some test content.',
					},
				],
			},
		});

		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as {
			doc: {
				id: string;
				title: string;
				content?: Array<{ blockType: string; [key: string]: unknown }>;
			};
		};
		const created = createBody.doc;

		expect(created.title).toBe(uniqueTitle);
		expect(created.content).toHaveLength(2);
		expect(created.content?.[0]?.blockType).toBe('hero');
		expect(created.content?.[0]?.['heading']).toBe('Test Hero');
		expect(created.content?.[1]?.blockType).toBe('textBlock');

		// Verify persistence via GET
		const getResponse = await request.get(`/api/pages/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as {
			doc: {
				content?: Array<{ blockType: string; [key: string]: unknown }>;
			};
		};
		expect(getBody.doc.content).toHaveLength(2);
		expect(getBody.doc.content?.[0]?.['heading']).toBe('Test Hero');
		expect(getBody.doc.content?.[1]?.['body']).toBe('Some test content.');

		// Clean up
		const deleteResponse = await request.delete(`/api/pages/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/pages/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('can update blocks via API', async ({ request }) => {
		const uniqueTitle = `Update Blocks Test ${Date.now()}`;

		// Create with initial blocks
		const createResponse = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: uniqueTitle,
				slug: `update-blocks-${Date.now()}`,
				content: [{ blockType: 'textBlock', body: 'Original content.' }],
			},
		});
		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as { doc: { id: string } };

		// Update: replace blocks
		const updateResponse = await request.patch(`/api/pages/${createBody.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				content: [
					{ blockType: 'hero', heading: 'New Hero', ctaText: 'Go' },
					{ blockType: 'feature', title: 'Speed', description: 'Very fast' },
				],
			},
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify the update
		const getResponse = await request.get(`/api/pages/${createBody.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as {
			doc: {
				content?: Array<{ blockType: string; [key: string]: unknown }>;
			};
		};
		expect(getBody.doc.content).toHaveLength(2);
		expect(getBody.doc.content?.[0]?.blockType).toBe('hero');
		expect(getBody.doc.content?.[0]?.['heading']).toBe('New Hero');
		expect(getBody.doc.content?.[1]?.blockType).toBe('feature');
		expect(getBody.doc.content?.[1]?.['title']).toBe('Speed');

		// Verify old data is gone
		const allBlockTypes = getBody.doc.content?.map((b) => b.blockType) ?? [];
		expect(allBlockTypes).not.toContain('textBlock');

		// Clean up
		const deleteResponse = await request.delete(`/api/pages/${createBody.doc.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/pages/${createBody.doc.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});

	test('blocks preserve blockType discriminator through CRUD', async ({ request }) => {
		const uniqueTitle = `BlockType Test ${Date.now()}`;

		// Create with mixed block types
		const createResponse = await request.post('/api/pages', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: uniqueTitle,
				slug: `blocktype-test-${Date.now()}`,
				content: [
					{ blockType: 'hero', heading: 'Hero' },
					{ blockType: 'textBlock', body: 'Text' },
					{ blockType: 'feature', title: 'Feature' },
				],
			},
		});
		expect(createResponse.ok()).toBe(true);

		const createBody = (await createResponse.json()) as {
			doc: {
				id: string;
				content?: Array<{ blockType: string }>;
			};
		};
		const created = createBody.doc;

		// Verify each block retained its blockType in create response
		expect(created.content?.[0]?.blockType).toBe('hero');
		expect(created.content?.[1]?.blockType).toBe('textBlock');
		expect(created.content?.[2]?.blockType).toBe('feature');

		// Verify persistence via GET - blockType must survive round-trip
		const getResponse = await request.get(`/api/pages/${created.id}`);
		expect(getResponse.ok()).toBe(true);

		const getBody = (await getResponse.json()) as {
			doc: {
				content?: Array<{ blockType: string }>;
			};
		};
		expect(getBody.doc.content).toHaveLength(3);
		expect(getBody.doc.content?.[0]?.blockType).toBe('hero');
		expect(getBody.doc.content?.[1]?.blockType).toBe('textBlock');
		expect(getBody.doc.content?.[2]?.blockType).toBe('feature');

		// Clean up
		const deleteResponse = await request.delete(`/api/pages/${created.id}`);
		expect(deleteResponse.ok(), 'Cleanup delete must succeed').toBe(true);

		// Verify deletion
		const verifyResponse = await request.get(`/api/pages/${created.id}`);
		expect(verifyResponse.ok()).toBe(false);
	});
});
