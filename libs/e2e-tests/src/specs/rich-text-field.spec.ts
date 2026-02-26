import { test, expect, TEST_AUTHOR2_CREDENTIALS } from '../fixtures';

/**
 * Rich text field E2E tests.
 * Verifies that richText content (HTML) is stored and retrieved correctly via the API,
 * and that the TipTap editor renders in the admin UI.
 */
test.describe('Rich text field', { tag: ['@field', '@admin'] }, () => {
	test.beforeEach(async ({ request }) => {
		const signInResponse = await request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR2_CREDENTIALS.email,
				password: TEST_AUTHOR2_CREDENTIALS.password,
			},
		});
		expect(signInResponse.ok(), 'Author2 sign-in must succeed').toBe(true);

		// Clean up any leftover rich text test articles
		const listResponse = await request.get('/api/articles?limit=1000');
		if (listResponse.ok()) {
			const listData = (await listResponse.json()) as {
				docs: Array<{ id: string; title?: string }>;
			};
			for (const doc of listData.docs) {
				if (doc.title?.startsWith('RT-')) {
					await request.delete(`/api/articles/${doc.id}`);
				}
			}
		}
	});

	test('stores HTML content via API create', async ({ request }) => {
		const htmlContent =
			'<h2>Rich Text Heading</h2><p>This is <strong>bold</strong> and <em>italic</em> text.</p>';

		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'RT-Create Test',
				content: htmlContent,
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string; content: string };
		};
		expect(created.doc.content).toBe(htmlContent);

		// Verify via GET
		const getResponse = await request.get(`/api/articles/${created.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const fetched = (await getResponse.json()) as {
			doc: { content: string };
		};
		expect(fetched.doc.content).toBe(htmlContent);
	});

	test('updates HTML content via API', async ({ request }) => {
		// Create article with initial content
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'RT-Update Test',
				content: '<p>Initial content</p>',
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		// Update with new HTML content
		const updatedHtml =
			'<h1>Updated Title</h1><ul><li>Item 1</li><li>Item 2</li></ul><blockquote><p>A quote</p></blockquote>';

		const updateResponse = await request.patch(`/api/articles/${created.doc.id}`, {
			headers: { 'Content-Type': 'application/json' },
			data: { content: updatedHtml },
		});
		expect(updateResponse.ok()).toBe(true);

		// Verify update persisted
		const getResponse = await request.get(`/api/articles/${created.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const fetched = (await getResponse.json()) as {
			doc: { content: string };
		};
		expect(fetched.doc.content).toBe(updatedHtml);
	});

	test('stores complex HTML with formatting, lists, and code blocks', async ({ request }) => {
		const complexHtml = [
			'<h2>Complex Content Test</h2>',
			'<p>Paragraph with <strong>bold</strong>, <em>italic</em>, and <u>underline</u>.</p>',
			'<ul><li>Bullet item 1</li><li>Bullet item 2</li></ul>',
			'<ol><li>Ordered item 1</li><li>Ordered item 2</li></ol>',
			'<pre><code>const x = 42;</code></pre>',
			'<hr>',
			'<blockquote><p>A wise quote</p></blockquote>',
		].join('');

		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'RT-Complex HTML',
				content: complexHtml,
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string; content: string };
		};
		expect(created.doc.content).toBe(complexHtml);
	});

	test('handles empty content', async ({ request }) => {
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'RT-Empty Content',
				content: '',
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string; content: string };
		};
		expect(['', null]).toContain(created.doc.content);
	});

	test('HTML content round-trips correctly through create and retrieve', async ({ request }) => {
		// Create an article with specific HTML structure
		const html =
			'<h1>Title</h1><p>Paragraph with <strong>bold</strong> and <a href="https://example.com">a link</a>.</p>';

		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'RT-Roundtrip Test',
				content: html,
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string; content: string };
		};

		// Retrieve and verify exact match
		const getResponse = await request.get(`/api/articles/${created.doc.id}`);
		expect(getResponse.ok()).toBe(true);

		const fetched = (await getResponse.json()) as {
			doc: { content: string };
		};

		expect(fetched.doc.content).toBe(html);
		expect(fetched.doc.content).toContain('<strong>');
		expect(fetched.doc.content).toContain('<h1>');
		expect(fetched.doc.content).toContain('<a href=');
	});

	test('rich text editor renders in admin UI', async ({ page, request }) => {
		// Create an article to edit (beforeEach already signed in via request context)
		const createResponse = await request.post('/api/articles', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				title: 'RT-Admin UI Test',
				content: '<p>Admin UI test content with <strong>bold</strong> text.</p>',
			},
		});
		expect(createResponse.status(), 'Article create should return 201').toBe(201);

		const created = (await createResponse.json()) as {
			doc: { id: string };
		};

		// Sign in via the page context (API request context doesn't share cookies with page)
		await page.goto('/admin/login');
		await page.waitForLoadState('domcontentloaded');

		const pageSignIn = await page.request.post('/api/auth/sign-in/email', {
			headers: { 'Content-Type': 'application/json' },
			data: {
				email: TEST_AUTHOR2_CREDENTIALS.email,
				password: TEST_AUTHOR2_CREDENTIALS.password,
			},
		});
		expect(pageSignIn.ok(), 'Page context sign-in must succeed').toBe(true);

		// Navigate to the article edit page
		await page.goto(`/admin/collections/articles/${created.doc.id}/edit`);
		await page.waitForLoadState('domcontentloaded');

		// The rich text editor container should be rendered
		const editor = page.locator('[data-testid="rich-text-editor"]');
		await expect(editor).toBeVisible({ timeout: 15000 });

		// The toolbar should be visible
		const toolbar = page.locator('[role="toolbar"]');
		await expect(toolbar).toBeVisible();

		// Verify toolbar buttons exist
		await expect(page.getByRole('button', { name: 'Bold' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Italic' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Underline' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Heading 1' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Heading 2' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Bullet list' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Numbered list' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Blockquote' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Code block' })).toBeVisible();

		// Wait for ProseMirror contenteditable area
		const proseMirror = editor.locator('.ProseMirror, [contenteditable="true"]');
		await expect(proseMirror).toBeVisible({ timeout: 10000 });
	});
});
