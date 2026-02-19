import { test, expect, TEST_CREDENTIALS } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';

/**
 * Visual Block Editor E2E Tests
 *
 * Tests the WYSIWYG visual block editor that activates when
 * admin.editor === 'visual' on a blocks field.
 *
 * The Pages collection in example-config uses visual editor mode.
 * Seeded pages: "Home Page" (3 blocks), "About Page" (1 block), "Empty Page" (0 blocks).
 */

/** Helper type for Page doc */
interface PageDoc {
	id: string;
	title: string;
	slug: string;
	content?: Array<{ blockType: string; [key: string]: unknown }>;
}

/** Counter to ensure unique slugs within a single worker */
let testPageCounter = 0;

/** Helper: create a test page via API */
async function createTestPage(
	request: APIRequestContext,
	blocks: Array<{ blockType: string; [key: string]: unknown }>,
	title?: string,
): Promise<PageDoc> {
	const ts = Date.now();
	testPageCounter++;
	const uniqueSlug = `ve-test-${ts}-${testPageCounter}-${Math.random().toString(36).slice(2, 8)}`;
	const pageTitle = title ?? `Visual Editor Test ${ts}-${testPageCounter}`;

	const response = await request.post('/api/pages', {
		headers: { 'Content-Type': 'application/json' },
		data: {
			title: pageTitle,
			slug: uniqueSlug,
			content: blocks,
		},
	});

	expect(response.ok(), 'Test page creation must succeed').toBe(true);
	const body = (await response.json()) as { doc: PageDoc };
	return body.doc;
}

/** Helper: delete a test page via API */
async function deleteTestPage(request: APIRequestContext, id: string): Promise<void> {
	const response = await request.delete(`/api/pages/${id}`);
	expect(response.ok(), 'Test page deletion must succeed').toBe(true);
}

/** Helper: get a seeded page by title */
async function getPageByTitle(request: APIRequestContext, title: string): Promise<PageDoc> {
	const response = await request.get('/api/pages?limit=50');
	expect(response.ok()).toBe(true);
	const data = (await response.json()) as { docs: PageDoc[] };
	const page = data.docs.find((d) => d.title === title);
	expect(page, `Page "${title}" should exist`).toBeTruthy();
	return page!;
}

test.describe('Visual Block Editor', { tag: ['@admin', '@blocks'] }, () => {
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

	// ── Render Tests ──

	test('renders visual editor for pages with editor=visual', async ({
		authenticatedPage,
		request,
	}) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Visual editor should render
		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Block wrappers should render for each block
		const blockWrappers = authenticatedPage.locator('[data-testid="block-wrapper"]');
		await expect(blockWrappers).toHaveCount(3, { timeout: 10000 });
	});

	test('shows block type attributes in block wrappers', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Check block types are properly identified via data attributes
		await expect(authenticatedPage.locator('[data-block-type="hero"]')).toBeVisible();
		await expect(authenticatedPage.locator('[data-block-type="textBlock"]')).toBeVisible();
		await expect(authenticatedPage.locator('[data-block-type="feature"]')).toBeVisible();
	});

	test('shows empty state for page with no blocks', async ({ authenticatedPage, request }) => {
		const emptyPage = await getPageByTitle(request, 'Empty Page');

		await authenticatedPage.goto(`/admin/collections/pages/${emptyPage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Should show empty state text
		await expect(authenticatedPage.getByText('No content blocks yet.')).toBeVisible();

		// Should show an inserter for adding the first block
		const inserter = authenticatedPage.locator('[data-testid="block-inserter"]');
		await expect(inserter).toBeVisible();
	});

	test('shows block inserters between blocks', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// With 3 blocks, should have 4 inserters: before first + between each + after last
		const inserters = authenticatedPage.locator('[data-testid="block-inserter"]');
		await expect(inserters).toHaveCount(4);
	});

	test('shows block header with controls', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Each block should have a header bar with controls
		const firstBlock = authenticatedPage.locator('[data-testid="block-wrapper"]').first();
		const header = firstBlock.locator('[data-testid="block-header"]');
		await expect(header).toBeVisible({ timeout: 5000 });

		// Header should have action buttons
		await expect(header.getByRole('button', { name: /Move block up/i })).toBeVisible();
		await expect(header.getByRole('button', { name: /Move block down/i })).toBeVisible();
		await expect(header.getByRole('button', { name: /Delete block/i })).toBeVisible();
	});

	test('shows block field values from seeded blocks', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Hero block should show seeded heading value in form input
		const heroBlock = visualEditor.locator('[data-block-type="hero"]');
		await expect(heroBlock.getByRole('textbox', { name: 'Heading', exact: true })).toHaveValue(
			'Welcome to Our Site',
		);

		// Text block should show seeded heading value in form input
		const textBlock = visualEditor.locator('[data-block-type="textBlock"]');
		await expect(textBlock.getByLabel('Section Heading')).toHaveValue('About Us');
	});

	test('shows block count', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Should show "3 blocks" count
		await expect(visualEditor.getByText('3 blocks')).toBeVisible();
	});

	test('block header shows block type label', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Each block header should display its block type label in a badge
		const heroBlock = visualEditor.locator('[data-block-type="hero"]');
		const heroLabel = heroBlock.locator('[data-testid="block-type-label"]');
		await expect(heroLabel).toContainText('Hero');

		const textBlock = visualEditor.locator('[data-block-type="textBlock"]');
		const textLabel = textBlock.locator('[data-testid="block-type-label"]');
		await expect(textLabel).toContainText('Text Block');

		const featureBlock = visualEditor.locator('[data-block-type="feature"]');
		const featureLabel = featureBlock.locator('[data-testid="block-type-label"]');
		await expect(featureLabel).toContainText('Feature');
	});

	test('can collapse and expand a block', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		const firstBlock = authenticatedPage.locator('[data-testid="block-wrapper"]').first();

		// Initially, block fields should be visible
		const blockFields = firstBlock.locator('[data-testid="block-fields"]');
		await expect(blockFields).toBeVisible({ timeout: 5000 });

		// Click the collapse toggle
		const collapseToggle = firstBlock.locator('[data-testid="block-collapse-toggle"]');
		await collapseToggle.click();

		// Block fields should now be hidden
		await expect(blockFields).toBeHidden({ timeout: 5000 });

		// Header should still be visible
		const header = firstBlock.locator('[data-testid="block-header"]');
		await expect(header).toBeVisible();

		// Click expand toggle
		await collapseToggle.click();

		// Block fields should be visible again
		await expect(blockFields).toBeVisible({ timeout: 5000 });
	});

	// ── Block CRUD via API round-trip ──

	test('can delete a block via toolbar and verify via API', async ({
		authenticatedPage,
		request,
	}) => {
		// Create test page with 2 blocks
		const page = await createTestPage(request, [
			{ blockType: 'hero', heading: 'Hero Block' },
			{ blockType: 'textBlock', heading: 'Text Heading', body: 'Text body' },
		]);

		try {
			await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
			await expect(visualEditor).toBeVisible({ timeout: 10000 });

			// Verify initial state: 2 blocks
			const blockWrappers = authenticatedPage.locator('[data-testid="block-wrapper"]');
			await expect(blockWrappers).toHaveCount(2, { timeout: 5000 });

			// Find delete button in the first block's header
			const firstHeader = blockWrappers.first().locator('[data-testid="block-header"]');
			await expect(firstHeader).toBeVisible({ timeout: 5000 });

			// Click delete button
			await firstHeader.getByRole('button', { name: /Delete block/i }).click();

			// Verify block was removed from UI
			await expect(blockWrappers).toHaveCount(1, { timeout: 5000 });

			// Save changes
			const saveButton = authenticatedPage.getByRole('button', { name: /Save|Update/i });
			await saveButton.click();

			// Wait for save to complete
			await expect(authenticatedPage.locator('.toast-title')).toBeVisible({
				timeout: 10000,
			});

			// Verify via API
			const getResponse = await request.get(`/api/pages/${page.id}`);
			expect(getResponse.ok()).toBe(true);
			const getBody = (await getResponse.json()) as { doc: PageDoc };
			expect(getBody.doc.content).toHaveLength(1);
			expect(getBody.doc.content?.[0]?.blockType).toBe('textBlock');
		} finally {
			await deleteTestPage(request, page.id);
		}
	});

	test('can add a block via inserter and verify via API', async ({
		authenticatedPage,
		request,
	}) => {
		// Create test page with 1 block
		const page = await createTestPage(request, [
			{ blockType: 'textBlock', heading: 'Existing Block', body: 'Some body text' },
		]);

		try {
			await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
			await expect(visualEditor).toBeVisible({ timeout: 10000 });

			// Verify initial state: 1 block
			const blockWrappers = authenticatedPage.locator('[data-testid="block-wrapper"]');
			await expect(blockWrappers).toHaveCount(1, { timeout: 5000 });

			// Click the inserter after the first block (index 1)
			const inserters = authenticatedPage.locator('[data-testid="block-inserter"]');
			await inserters.last().locator('button').click();

			// Command palette should appear with block type options
			const heroOption = authenticatedPage.getByRole('option', { name: /Hero/i });
			await expect(heroOption).toBeVisible({ timeout: 5000 });
			await heroOption.click();

			// Should now have 2 blocks
			await expect(blockWrappers).toHaveCount(2, { timeout: 5000 });

			// Save changes
			const saveButton = authenticatedPage.getByRole('button', { name: /Save|Update/i });
			await saveButton.click();

			// Wait for save to complete
			await expect(authenticatedPage.locator('.toast-title')).toBeVisible({
				timeout: 10000,
			});

			// Verify via API
			const getResponse = await request.get(`/api/pages/${page.id}`);
			expect(getResponse.ok()).toBe(true);
			const getBody = (await getResponse.json()) as { doc: PageDoc };
			expect(getBody.doc.content).toHaveLength(2);
			expect(getBody.doc.content?.[0]?.blockType).toBe('textBlock');
			expect(getBody.doc.content?.[1]?.blockType).toBe('hero');
		} finally {
			await deleteTestPage(request, page.id);
		}
	});

	test('can edit block field via form input and verify via API', async ({
		authenticatedPage,
		request,
	}) => {
		// Create test page with hero block containing known heading
		const page = await createTestPage(request, [
			{ blockType: 'hero', heading: 'Original Heading', subheading: '', ctaText: '', ctaLink: '' },
		]);

		try {
			await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
			await expect(visualEditor).toBeVisible({ timeout: 10000 });

			// Find the heading input within the block wrapper (rendered by FieldRenderer)
			const headingInput = visualEditor.getByRole('textbox', { name: 'Heading', exact: true });
			await expect(headingInput).toBeVisible({ timeout: 5000 });

			// Clear and type new value (Signal Forms: use triple-click + type)
			await headingInput.click({ clickCount: 3 });
			await authenticatedPage.keyboard.type('Updated Heading');

			// Save changes
			const saveButton = authenticatedPage.getByRole('button', { name: /Save|Update/i });
			await saveButton.click();

			// Wait for save to complete
			await expect(authenticatedPage.locator('.toast-title')).toBeVisible({
				timeout: 10000,
			});

			// Verify via API
			const getResponse = await request.get(`/api/pages/${page.id}`);
			expect(getResponse.ok()).toBe(true);
			const getBody = (await getResponse.json()) as { doc: PageDoc };
			expect(getBody.doc.content).toHaveLength(1);
			expect(getBody.doc.content?.[0]?.heading).toBe('Updated Heading');
		} finally {
			await deleteTestPage(request, page.id);
		}
	});

	test('can move block via header and verify via API', async ({ authenticatedPage, request }) => {
		// Create test page with 2 blocks
		const page = await createTestPage(request, [
			{ blockType: 'hero', heading: 'First Block' },
			{ blockType: 'textBlock', heading: 'Second Block', body: 'Body text' },
		]);

		try {
			await authenticatedPage.goto(`/admin/collections/pages/${page.id}/edit`);
			await authenticatedPage.waitForLoadState('domcontentloaded');

			const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
			await expect(visualEditor).toBeVisible({ timeout: 10000 });

			// Find the first block's header
			const blockWrappers = authenticatedPage.locator('[data-testid="block-wrapper"]');
			const firstHeader = blockWrappers.first().locator('[data-testid="block-header"]');
			await expect(firstHeader).toBeVisible({ timeout: 5000 });

			// Click "Move block down" button in the header
			await firstHeader.getByRole('button', { name: /Move block down/i }).click();

			// Save changes
			const saveButton = authenticatedPage.getByRole('button', { name: /Save|Update/i });
			await saveButton.click();

			// Wait for save to complete
			await expect(authenticatedPage.locator('.toast-title')).toBeVisible({
				timeout: 10000,
			});

			// Verify via API: blocks should be swapped
			const getResponse = await request.get(`/api/pages/${page.id}`);
			expect(getResponse.ok()).toBe(true);
			const getBody = (await getResponse.json()) as { doc: PageDoc };
			expect(getBody.doc.content).toHaveLength(2);
			expect(getBody.doc.content?.[0]?.blockType).toBe('textBlock');
			expect(getBody.doc.content?.[1]?.blockType).toBe('hero');
		} finally {
			await deleteTestPage(request, page.id);
		}
	});

	// ── Accessibility ──

	test('block list has correct ARIA roles', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// Block list container should have role="list"
		const blockList = visualEditor.locator('[role="list"]');
		await expect(blockList).toBeVisible();

		// Block wrappers should have role="listitem"
		const listitems = visualEditor.locator('[role="listitem"]');
		await expect(listitems).toHaveCount(3);

		// Block header should contain a toolbar with role="toolbar"
		const firstBlock = authenticatedPage.locator('[data-testid="block-wrapper"]').first();
		const toolbar = firstBlock.locator('[role="toolbar"]');
		await expect(toolbar).toBeVisible({ timeout: 5000 });
	});

	test('block wrappers have aria-labels', async ({ authenticatedPage, request }) => {
		const homePage = await getPageByTitle(request, 'Home Page');

		await authenticatedPage.goto(`/admin/collections/pages/${homePage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// First block should have descriptive aria-label
		const firstBlock = authenticatedPage.locator('[data-testid="block-wrapper"]').first();
		const ariaLabel = await firstBlock.getAttribute('aria-label');
		expect(ariaLabel).toContain('block');
		expect(ariaLabel).toContain('position 1');
	});

	test('inserters have aria-labels for each position', async ({ authenticatedPage, request }) => {
		const aboutPage = await getPageByTitle(request, 'About Page');

		await authenticatedPage.goto(`/admin/collections/pages/${aboutPage.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const visualEditor = authenticatedPage.locator('[data-testid="visual-block-editor"]');
		await expect(visualEditor).toBeVisible({ timeout: 10000 });

		// With 1 block, inserters should have position labels
		const addButtons = authenticatedPage.getByRole('button', {
			name: /Add block at position/i,
		});
		await expect(addButtons).toHaveCount(2); // Before + after the single block
	});
});
