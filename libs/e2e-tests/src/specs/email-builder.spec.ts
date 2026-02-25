import { test, expect, TEST_CREDENTIALS } from '../fixtures';

/**
 * Email Builder E2E Tests
 *
 * Tests the email builder admin page at /admin/email-builder.
 * The builder is a client-side tool with no API persistence,
 * so tests focus on UI interactions: adding, removing, reordering blocks,
 * and exporting HTML.
 */

test.describe('Email Builder', { tag: ['@admin'] }, () => {
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

	test('should display email builder page with editor and preview panels', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Studio wrapper should render
		const studio = authenticatedPage.locator('[data-testid="email-builder-studio"]');
		await expect(studio).toBeVisible({ timeout: 10000 });

		// Should have editor and preview panels
		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		const previewPanel = authenticatedPage.locator('[data-testid="email-preview-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });
		await expect(previewPanel).toBeVisible({ timeout: 10000 });

		// Should show the email builder component
		const builder = authenticatedPage.locator('[data-testid="email-builder"]');
		await expect(builder).toBeVisible();

		// Should show export HTML button
		const exportButton = authenticatedPage.locator('[data-testid="export-html-button"]');
		await expect(exportButton).toBeVisible();
	});

	test('should start with empty state and show inserter', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// No blocks initially
		const blockWrappers = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');
		await expect(blockWrappers).toHaveCount(0);

		// Should show empty state message
		await expect(editorPanel.getByText(/no blocks yet/i)).toBeVisible();

		// Should show at least one inserter trigger button
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await expect(inserterToggle.first()).toBeVisible();
	});

	test('should show block inserter with available block types', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Click the first inserter toggle to open the block picker
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();

		// Block options should appear (default blocks: header, text, button, image, divider, spacer, columns, footer)
		await expect(authenticatedPage.locator('[data-testid="block-option-header"]')).toBeVisible({
			timeout: 5000,
		});
		await expect(authenticatedPage.locator('[data-testid="block-option-text"]')).toBeVisible();
		await expect(authenticatedPage.locator('[data-testid="block-option-button"]')).toBeVisible();
		await expect(authenticatedPage.locator('[data-testid="block-option-divider"]')).toBeVisible();
		await expect(authenticatedPage.locator('[data-testid="block-option-footer"]')).toBeVisible();
	});

	test('should add a text block via inserter', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Click first inserter
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();

		// Select "text" block type
		await authenticatedPage.locator('[data-testid="block-option-text"]').click();

		// Should now have 1 block
		const blockWrappers = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');
		await expect(blockWrappers).toHaveCount(1, { timeout: 5000 });

		// Block should have type attribute "text"
		await expect(authenticatedPage.locator('[data-block-type="text"]')).toBeVisible();

		// Empty state should be gone
		await expect(editorPanel.getByText(/no blocks yet/i)).toBeHidden();
	});

	test('should add multiple blocks and see them in editor', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Add header block
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();
		await authenticatedPage.locator('[data-testid="block-option-header"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
			timeout: 5000,
		});

		// Add text block (use the last inserter, which appears after the header)
		await authenticatedPage.locator('[data-testid="block-inserter-toggle"]').last().click();
		await authenticatedPage.locator('[data-testid="block-option-text"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(2, {
			timeout: 5000,
		});

		// Add button block
		await authenticatedPage.locator('[data-testid="block-inserter-toggle"]').last().click();
		await authenticatedPage.locator('[data-testid="block-option-button"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(3, {
			timeout: 5000,
		});

		// Verify block types in order
		const blocks = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');
		await expect(blocks.nth(0)).toHaveAttribute('data-block-type', 'header');
		await expect(blocks.nth(1)).toHaveAttribute('data-block-type', 'text');
		await expect(blocks.nth(2)).toHaveAttribute('data-block-type', 'button');

		// Should show block count in the studio header
		await expect(authenticatedPage.getByText('3 blocks')).toBeVisible();
	});

	test('should remove a block', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Add two blocks
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();
		await authenticatedPage.locator('[data-testid="block-option-header"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
			timeout: 5000,
		});

		await authenticatedPage.locator('[data-testid="block-inserter-toggle"]').last().click();
		await authenticatedPage.locator('[data-testid="block-option-text"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(2, {
			timeout: 5000,
		});

		// Delete the first block (header)
		const firstBlock = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
		await firstBlock.locator('[data-testid="block-delete"]').click();

		// Should now have 1 block
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
			timeout: 5000,
		});

		// Remaining block should be text
		await expect(authenticatedPage.locator('[data-block-type="text"]')).toBeVisible();
		await expect(authenticatedPage.locator('[data-block-type="header"]')).toBeHidden();
	});

	test('should reorder blocks via move up/down buttons', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Add header then text block
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();
		await authenticatedPage.locator('[data-testid="block-option-header"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
			timeout: 5000,
		});

		await authenticatedPage.locator('[data-testid="block-inserter-toggle"]').last().click();
		await authenticatedPage.locator('[data-testid="block-option-text"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(2, {
			timeout: 5000,
		});

		// Initial order: header, text
		const blocks = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');
		await expect(blocks.nth(0)).toHaveAttribute('data-block-type', 'header');
		await expect(blocks.nth(1)).toHaveAttribute('data-block-type', 'text');

		// Move header down (first block's move-down button)
		await blocks.nth(0).locator('[data-testid="block-move-down"]').click();

		// New order should be: text, header
		await expect(blocks.nth(0)).toHaveAttribute('data-block-type', 'text');
		await expect(blocks.nth(1)).toHaveAttribute('data-block-type', 'header');

		// Move header back up (now second block's move-up button)
		await blocks.nth(1).locator('[data-testid="block-move-up"]').click();

		// Back to original order: header, text
		await expect(blocks.nth(0)).toHaveAttribute('data-block-type', 'header');
		await expect(blocks.nth(1)).toHaveAttribute('data-block-type', 'text');
	});

	test('should duplicate a block', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Add a header block
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();
		await authenticatedPage.locator('[data-testid="block-option-header"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
			timeout: 5000,
		});

		// Duplicate it
		const firstBlock = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
		await firstBlock.locator('[data-testid="block-duplicate"]').click();

		// Should now have 2 header blocks
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(2, {
			timeout: 5000,
		});
		await expect(authenticatedPage.locator('[data-block-type="header"]')).toHaveCount(2);
	});

	test('should show preview panel with iframe', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const previewPanel = authenticatedPage.locator('[data-testid="email-preview-panel"]');
		await expect(previewPanel).toBeVisible({ timeout: 10000 });

		// Preview should contain an iframe
		const iframe = previewPanel.locator('iframe[title="Email preview"]');
		await expect(iframe).toBeVisible();
	});

	test('should export HTML output', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Add a header block
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();
		await authenticatedPage.locator('[data-testid="block-option-header"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
			timeout: 5000,
		});

		// Click export button
		await authenticatedPage.locator('[data-testid="export-html-button"]').click();

		// Output textarea should contain valid HTML
		const outputTextarea = authenticatedPage.locator('[data-testid="email-builder-output"]');
		const htmlContent = await outputTextarea.inputValue();

		expect(htmlContent).toContain('<!DOCTYPE html>');
		expect(htmlContent).toContain('role="presentation"');
		expect(htmlContent).toContain('background-color');
	});

	test('move up button is disabled on first block, move down disabled on last', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/email-builder');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
		await expect(editorPanel).toBeVisible({ timeout: 10000 });

		// Add two blocks
		const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
		await inserterToggle.first().click();
		await authenticatedPage.locator('[data-testid="block-option-header"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
			timeout: 5000,
		});

		await authenticatedPage.locator('[data-testid="block-inserter-toggle"]').last().click();
		await authenticatedPage.locator('[data-testid="block-option-text"]').click();
		await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(2, {
			timeout: 5000,
		});

		const blocks = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');

		// First block: move-up should be disabled
		await expect(blocks.nth(0).locator('[data-testid="block-move-up"]')).toBeDisabled();
		await expect(blocks.nth(0).locator('[data-testid="block-move-down"]')).toBeEnabled();

		// Last block: move-down should be disabled
		await expect(blocks.nth(1).locator('[data-testid="block-move-up"]')).toBeEnabled();
		await expect(blocks.nth(1).locator('[data-testid="block-move-down"]')).toBeDisabled();
	});

	test('should navigate from admin sidebar to email builder', async ({ authenticatedPage }) => {
		// Start at admin dashboard
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Look for email builder link in sidebar
		const emailBuilderLink = authenticatedPage.getByRole('link', { name: /email builder/i });
		await expect(emailBuilderLink).toBeVisible({ timeout: 10000 });

		// Click the sidebar link
		await emailBuilderLink.click();

		// Should navigate to email builder page
		await authenticatedPage.waitForURL(/\/admin\/email-builder/);

		// Email builder should be visible
		const studio = authenticatedPage.locator('[data-testid="email-builder-studio"]');
		await expect(studio).toBeVisible({ timeout: 10000 });
	});

	test.describe('Preview Realtime Updates', { tag: ['@admin'] }, () => {
		test('preview should update when text block content changes', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			// Add a text block
			const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await authenticatedPage.locator('[data-testid="block-option-text"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
				timeout: 5000,
			});

			// Select the block to show editor
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
			await block.click();

			// Wait for editor to be visible
			const editorContainer = block.locator('[data-testid="block-editor-container"]');
			await expect(editorContainer).toBeVisible({ timeout: 3000 });

			// Get the preview iframe
			const previewPanel = authenticatedPage.locator('[data-testid="email-preview-panel"]');
			const iframe = previewPanel.locator('iframe[title="Email preview"]');
			await expect(iframe).toBeVisible();

			// Verify default text is visible in preview
			const previewFrame = iframe.contentFrame();
			await expect(previewFrame.locator('body')).toContainText('Your text here...', {
				timeout: 5000,
			});

			// Clear the content textarea and type new text
			const textarea = editorContainer.locator('textarea');
			await textarea.fill('Hello from the E2E test!');

			// Preview should update to show the new content
			await expect(previewFrame.locator('body')).toContainText('Hello from the E2E test!', {
				timeout: 5000,
			});
		});

		test('preview should update when header block title changes', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			// Add a header block
			const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await authenticatedPage.locator('[data-testid="block-option-header"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
				timeout: 5000,
			});

			// Select and open editor
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
			await block.click();
			const editorContainer = block.locator('[data-testid="block-editor-container"]');
			await expect(editorContainer).toBeVisible({ timeout: 3000 });

			// Get preview frame
			const previewPanel = authenticatedPage.locator('[data-testid="email-preview-panel"]');
			const iframe = previewPanel.locator('iframe[title="Email preview"]');
			const previewFrame = iframe.contentFrame();

			// Default header title
			await expect(previewFrame.locator('h1')).toContainText('Welcome', { timeout: 5000 });

			// Update the header title
			const titleInput = editorContainer.locator('input').first();
			await titleInput.fill('New Header Title');

			// Preview should reflect the change
			await expect(previewFrame.locator('h1')).toContainText('New Header Title', {
				timeout: 5000,
			});
		});
	});

	test.describe('Numeric Input Behavior', { tag: ['@admin'] }, () => {
		test('font size input should accept multi-digit values', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			// Add a text block
			const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await authenticatedPage.locator('[data-testid="block-option-text"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
				timeout: 5000,
			});

			// Select the block
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
			await block.click();
			const editorContainer = block.locator('[data-testid="block-editor-container"]');
			await expect(editorContainer).toBeVisible({ timeout: 3000 });

			// Find the font size input
			const fontSizeInput = editorContainer.locator('[data-testid="font-size-input"]');
			await expect(fontSizeInput).toBeVisible();

			// Clear and type a multi-digit value
			await fontSizeInput.fill('32');

			// The value should remain as entered (not snap back to default)
			await expect(fontSizeInput).toHaveValue('32');

			// Preview should reflect the new font size
			const previewPanel = authenticatedPage.locator('[data-testid="email-preview-panel"]');
			const iframe = previewPanel.locator('iframe[title="Email preview"]');
			const previewFrame = iframe.contentFrame();
			await expect(previewFrame.locator('p')).toHaveCSS('font-size', '32px', {
				timeout: 5000,
			});
		});

		test('font size input should allow clearing and retyping', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			// Add a text block
			const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await authenticatedPage.locator('[data-testid="block-option-text"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
				timeout: 5000,
			});

			// Select the block
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
			await block.click();
			const editorContainer = block.locator('[data-testid="block-editor-container"]');
			await expect(editorContainer).toBeVisible({ timeout: 3000 });

			const fontSizeInput = editorContainer.locator('[data-testid="font-size-input"]');

			// Should start with default value 16
			await expect(fontSizeInput).toHaveValue('16');

			// Clear the field
			await fontSizeInput.fill('');

			// Type a new multi-digit value character by character
			await fontSizeInput.type('24');

			// Should show the typed value
			await expect(fontSizeInput).toHaveValue('24');
		});

		test('spacer height input should accept multi-digit values', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			// Add a spacer block
			const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await authenticatedPage.locator('[data-testid="block-option-spacer"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
				timeout: 5000,
			});

			// Select the block
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
			await block.click();
			const editorContainer = block.locator('[data-testid="block-editor-container"]');
			await expect(editorContainer).toBeVisible({ timeout: 3000 });

			// Find the spacer height input
			const heightInput = editorContainer.locator('[data-testid="spacer-height-input"]');
			await expect(heightInput).toBeVisible();

			// Should start with default value 24
			await expect(heightInput).toHaveValue('24');

			// Clear and type a new value
			await heightInput.fill('48');
			await expect(heightInput).toHaveValue('48');

			// Preview should reflect the new height
			const previewPanel = authenticatedPage.locator('[data-testid="email-preview-panel"]');
			const iframe = previewPanel.locator('iframe[title="Email preview"]');
			const previewFrame = iframe.contentFrame();
			await expect(previewFrame.locator('div[style*="height: 48px"]')).toBeVisible({
				timeout: 5000,
			});
		});
	});

	test.describe('Input Persistence (character-by-character typing)', { tag: ['@admin'] }, () => {
		async function addAndSelectBlock(
			page: import('@playwright/test').Page,
			type: string,
		): Promise<import('@playwright/test').Locator> {
			const inserterToggle = page.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await page.locator(`[data-testid="block-option-${type}"]`).click();
			const block = page.locator('[data-testid="eml-block-wrapper"]').first();
			await expect(block).toBeVisible({ timeout: 5000 });
			await block.click();
			await expect(block.locator('[data-testid="block-editor-container"]')).toBeVisible({
				timeout: 3000,
			});
			return block;
		}

		test('text block textarea should keep all characters when typing', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			await expect(authenticatedPage.locator('[data-testid="email-editor-panel"]')).toBeVisible({
				timeout: 10000,
			});

			const block = await addAndSelectBlock(authenticatedPage, 'text');
			const editor = block.locator('[data-testid="block-editor-container"]');
			const textarea = editor.locator('textarea');

			// Clear default and type character by character
			await textarea.clear();
			await textarea.pressSequentially('Hello World', { delay: 50 });

			// Every character should be preserved
			await expect(textarea).toHaveValue('Hello World');
		});

		test('header block title input should keep all characters when typing', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			await expect(authenticatedPage.locator('[data-testid="email-editor-panel"]')).toBeVisible({
				timeout: 10000,
			});

			const block = await addAndSelectBlock(authenticatedPage, 'header');
			const editor = block.locator('[data-testid="block-editor-container"]');
			const titleInput = editor.locator('input[type="text"]').first();

			await titleInput.clear();
			await titleInput.pressSequentially('My Header', { delay: 50 });

			await expect(titleInput).toHaveValue('My Header');
		});

		test('button block label input should keep all characters when typing', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			await expect(authenticatedPage.locator('[data-testid="email-editor-panel"]')).toBeVisible({
				timeout: 10000,
			});

			const block = await addAndSelectBlock(authenticatedPage, 'button');
			const editor = block.locator('[data-testid="block-editor-container"]');
			const labelInput = editor.locator('input[type="text"]').first();

			await labelInput.clear();
			await labelInput.pressSequentially('Click Me', { delay: 50 });

			await expect(labelInput).toHaveValue('Click Me');
		});

		test('numeric font size input should keep all digits when typing', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			await expect(authenticatedPage.locator('[data-testid="email-editor-panel"]')).toBeVisible({
				timeout: 10000,
			});

			const block = await addAndSelectBlock(authenticatedPage, 'text');
			const editor = block.locator('[data-testid="block-editor-container"]');
			const fontSizeInput = editor.locator('[data-testid="font-size-input"]');

			// Clear and type digit by digit
			await fontSizeInput.clear();
			await fontSizeInput.pressSequentially('128', { delay: 50 });

			await expect(fontSizeInput).toHaveValue('128');
		});
	});

	test.describe('Hardening: Duplicate Block Independence', { tag: ['@admin'] }, () => {
		test('duplicated blocks should be independent (editing one does not affect the other)', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			// Add a text block
			const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await authenticatedPage.locator('[data-testid="block-option-text"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
				timeout: 5000,
			});

			// Type content into the first block
			const firstBlock = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
			await firstBlock.click();
			const firstEditor = firstBlock.locator('[data-testid="block-editor-container"]');
			await expect(firstEditor).toBeVisible({ timeout: 3000 });
			const firstTextarea = firstEditor.locator('textarea');
			await firstTextarea.fill('Original content');

			// Duplicate the block
			await firstBlock.locator('[data-testid="block-duplicate"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(2, {
				timeout: 5000,
			});

			// Edit the duplicated block (second one, which is auto-selected)
			const secondBlock = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').nth(1);
			const secondEditor = secondBlock.locator('[data-testid="block-editor-container"]');
			await expect(secondEditor).toBeVisible({ timeout: 3000 });
			const secondTextarea = secondEditor.locator('textarea');
			await secondTextarea.fill('Modified duplicate');

			// Verify original is unchanged
			await firstBlock.click();
			await expect(firstBlock.locator('[data-testid="block-editor-container"]')).toBeVisible({
				timeout: 3000,
			});
			const originalTextarea = firstBlock
				.locator('[data-testid="block-editor-container"]')
				.locator('textarea');
			await expect(originalTextarea).toHaveValue('Original content');

			// Verify duplicate has new value
			await secondBlock.click();
			await expect(secondBlock.locator('[data-testid="block-editor-container"]')).toBeVisible({
				timeout: 3000,
			});
			const dupTextarea = secondBlock
				.locator('[data-testid="block-editor-container"]')
				.locator('textarea');
			await expect(dupTextarea).toHaveValue('Modified duplicate');
		});
	});

	test.describe('Hardening: Export HTML Safety', { tag: ['@admin'] }, () => {
		test('exported HTML should not contain javascript: in button href', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			// Add a button block
			const inserterToggle = authenticatedPage.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.first().click();
			await authenticatedPage.locator('[data-testid="block-option-button"]').click();
			await expect(authenticatedPage.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(1, {
				timeout: 5000,
			});

			// Select and enter a javascript: URL
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();
			await block.click();
			const editor = block.locator('[data-testid="block-editor-container"]');
			await expect(editor).toBeVisible({ timeout: 3000 });

			const urlInput = editor.locator('input[type="url"]');
			await urlInput.fill('javascript:alert(1)');

			// Export HTML
			await authenticatedPage.locator('[data-testid="export-html-button"]').click();
			const outputTextarea = authenticatedPage.locator('[data-testid="email-builder-output"]');
			const htmlContent = await outputTextarea.inputValue();

			// Should NOT contain javascript: in the href
			expect(htmlContent).not.toContain('javascript:');
			// Should contain sanitized href="#"
			expect(htmlContent).toContain('href="#"');
		});
	});

	test.describe('Block Collapse/Expand', { tag: ['@admin'] }, () => {
		async function addBlock(
			page: import('@playwright/test').Page,
			type: string,
			expectedCount: number,
		): Promise<void> {
			const inserterToggle = page.locator('[data-testid="block-inserter-toggle"]');
			await inserterToggle.last().click();
			await page.locator(`[data-testid="block-option-${type}"]`).click();
			await expect(page.locator('[data-testid="eml-block-wrapper"]')).toHaveCount(expectedCount, {
				timeout: 5000,
			});
		}

		const editorContainer = '[data-testid="block-editor-container"]';

		test('each block should show a collapse toggle button', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			await addBlock(authenticatedPage, 'header', 1);
			await addBlock(authenticatedPage, 'text', 2);

			const blocks = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');

			// Both blocks should have a collapse toggle
			for (let i = 0; i < 2; i++) {
				const toggle = blocks.nth(i).locator('[data-testid="block-collapse-toggle"]');
				await expect(toggle).toBeVisible();
				await expect(toggle).toHaveAttribute('aria-expanded', 'true');
			}
		});

		test('clicking collapse toggle should hide the editor and update aria-expanded', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			await addBlock(authenticatedPage, 'text', 1);
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();

			// Click block to select and show editor
			await block.click();
			await expect(block.locator(editorContainer)).toBeVisible({ timeout: 3000 });

			// Collapse the block
			const toggle = block.locator('[data-testid="block-collapse-toggle"]');
			await toggle.click();

			// Editor should be hidden and aria-expanded should be false
			await expect(block.locator(editorContainer)).toBeHidden();
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');

			// Host should have collapsed class
			await expect(block).toHaveClass(/eml-block-wrapper--collapsed/);
		});

		test('clicking collapse toggle on collapsed block should expand and show editor', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			await addBlock(authenticatedPage, 'text', 1);
			const block = authenticatedPage.locator('[data-testid="eml-block-wrapper"]').first();

			// Select block first, then collapse it
			await block.click();
			await expect(block.locator(editorContainer)).toBeVisible({ timeout: 3000 });
			const toggle = block.locator('[data-testid="block-collapse-toggle"]');
			await toggle.click();
			await expect(block.locator(editorContainer)).toBeHidden();

			// Expand the block by clicking the toggle again
			await toggle.click();

			// Editor should be visible (toggle auto-selects on expand)
			await expect(block.locator(editorContainer)).toBeVisible({ timeout: 3000 });
			await expect(toggle).toHaveAttribute('aria-expanded', 'true');
			await expect(block).not.toHaveClass(/eml-block-wrapper--collapsed/);
		});

		test('clicking a collapsed block body should expand and select it', async ({
			authenticatedPage,
		}) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			await addBlock(authenticatedPage, 'header', 1);
			await addBlock(authenticatedPage, 'text', 2);
			const blocks = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');

			// Collapse the first block by selecting it, then toggling
			const firstBlock = blocks.first();
			await firstBlock.click();
			await expect(firstBlock.locator(editorContainer)).toBeVisible({ timeout: 3000 });
			await firstBlock.locator('[data-testid="block-collapse-toggle"]').click();
			await expect(firstBlock.locator(editorContainer)).toBeHidden();

			// Click the second block to move selection away
			const secondBlock = blocks.nth(1);
			await secondBlock.click();

			// Click the collapsed first block body (not the toggle)
			await firstBlock.click();

			// Should expand and show editor
			await expect(firstBlock.locator(editorContainer)).toBeVisible({ timeout: 3000 });
			await expect(firstBlock).toHaveClass(/eml-block-wrapper--selected/);
			await expect(firstBlock).not.toHaveClass(/eml-block-wrapper--collapsed/);
		});

		test('collapsing one block should not affect other blocks', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/admin/email-builder');
			const editorPanel = authenticatedPage.locator('[data-testid="email-editor-panel"]');
			await expect(editorPanel).toBeVisible({ timeout: 10000 });

			await addBlock(authenticatedPage, 'header', 1);
			await addBlock(authenticatedPage, 'text', 2);
			await addBlock(authenticatedPage, 'button', 3);
			const blocks = authenticatedPage.locator('[data-testid="eml-block-wrapper"]');

			// Select and collapse the middle block (text)
			const middleBlock = blocks.nth(1);
			await middleBlock.click();
			await middleBlock.locator('[data-testid="block-collapse-toggle"]').click();
			await expect(middleBlock).toHaveClass(/eml-block-wrapper--collapsed/);

			// Other blocks should NOT be collapsed
			await expect(blocks.nth(0)).not.toHaveClass(/eml-block-wrapper--collapsed/);
			await expect(blocks.nth(2)).not.toHaveClass(/eml-block-wrapper--collapsed/);

			// First block should still be expandable
			await blocks.nth(0).click();
			const firstToggle = blocks.nth(0).locator('[data-testid="block-collapse-toggle"]');
			await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
		});
	});
});
