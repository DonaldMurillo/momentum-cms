import { test, expect, checkA11y } from '../fixtures';

/**
 * Theme Editor E2E Tests
 *
 * Tests the headless theme editor page (public route, no auth required).
 * Verifies: page load, preset selection, color editing,
 * light/dark mode toggle, undo/redo, CSS output, live preview,
 * and WCAG 2.1 AA compliance via axe-core.
 */
test.describe('Theme editor', { tag: ['@headless', '@tools'] }, () => {
	test('loads and displays controls and preview', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('[data-testid="theme-controls"]')).toBeVisible({
			timeout: 10000,
		});
		await expect(page.locator('[data-testid="theme-preview"]')).toBeVisible();
	});

	test('is linked from headless styling lab', async ({ page }) => {
		await page.goto('/headless-styling-lab');
		await page.waitForLoadState('domcontentloaded');

		const link = page.locator('[data-testid="lab-theme-editor-link"]');
		await expect(link).toBeVisible({ timeout: 10000 });
		await link.click();
		await expect(page).toHaveURL(/\/theme-editor/, { timeout: 10000 });
	});

	test('preset selection updates preview', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('[data-testid="theme-controls"]')).toBeVisible({
			timeout: 10000,
		});

		// Capture initial style innerHTML (textContent is empty for <style> in Playwright)
		const styleEl = page.locator('[data-testid="theme-preview-scope"] > style').first();
		const initialCSS = await styleEl.evaluate((el) => el.innerHTML);

		// Select "Ocean" preset
		await page.getByRole('button', { name: /ocean/i }).click();

		// Verify the CSS actually changed
		await expect
			.poll(() => styleEl.evaluate((el) => el.innerHTML), { timeout: 5000 })
			.not.toBe(initialCSS);
	});

	test('color picker modifies theme', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('[data-testid="theme-controls"]')).toBeVisible({
			timeout: 10000,
		});

		// Find the primary color text input and change it (use .first() — desktop + mobile both render)
		const primaryInput = page.locator('input[data-testid="color-primary"]').first();
		// Clear and type to avoid Angular [value] binding overwriting fill()
		await primaryInput.click({ clickCount: 3 });
		await primaryInput.pressSequentially('oklch(0.6 0.2 250)');
		await primaryInput.press('Enter');

		// Preview style innerHTML should reflect new value
		const styleEl = page.locator('[data-testid="theme-preview-scope"] > style').first();
		await expect
			.poll(() => styleEl.evaluate((el) => el.innerHTML), { timeout: 5000 })
			.toContain('oklch(0.6 0.2 250)');
	});

	test('light/dark mode toggle switches preview', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('[data-testid="theme-preview"]')).toBeVisible({
			timeout: 10000,
		});

		// Toggle to dark mode (exact match to avoid matching preset descriptions)
		await page.getByRole('button', { name: 'Dark', exact: true }).click();
		const previewContainer = page.locator('[data-testid="theme-preview-scope"]');
		await expect(previewContainer).toHaveClass(/dark/, { timeout: 5000 });
	});

	test('undo/redo works', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('[data-testid="theme-controls"]')).toBeVisible({
			timeout: 10000,
		});

		const styleEl = page.locator('[data-testid="theme-preview-scope"] > style').first();

		// Make a change by selecting a preset
		await page.getByRole('button', { name: /ocean/i }).click();
		// Source: THEME_PRESETS ocean.styles.light.primary in libs/theme-editor/src/lib/presets/index.ts
		const oceanPrimary = 'oklch(0.488 0.243 264.376)';
		await expect
			.poll(() => styleEl.evaluate((el) => el.innerHTML), { timeout: 5000 })
			.toContain(oceanPrimary);

		// Undo button should be enabled
		const undoBtn = page.getByRole('button', { name: /undo/i });
		await expect(undoBtn).toBeEnabled({ timeout: 5000 });
		await undoBtn.click();

		// Source: defaultLightStyles.primary in libs/theme-editor/src/lib/theme-defaults.ts
		const defaultPrimary = 'oklch(0.205 0 0)';
		// Verify the preview reverted — default primary should be back
		await expect
			.poll(() => styleEl.evaluate((el) => el.innerHTML), { timeout: 5000 })
			.toContain(`--primary: ${defaultPrimary}`);

		// Redo should be enabled after undo
		await expect(page.getByRole('button', { name: /redo/i })).toBeEnabled({
			timeout: 5000,
		});
	});

	test('copy CSS to clipboard', async ({ page, context }) => {
		// Grant clipboard permissions so readText() works in headless mode
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);

		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('[data-testid="theme-preview"]')).toBeVisible({
			timeout: 10000,
		});

		// CSS output should be visible
		const codeBlock = page.locator('[data-testid="css-output"]');
		await expect(codeBlock).toBeVisible({ timeout: 5000 });
		await expect(codeBlock).toContainText(':root');
		await expect(codeBlock).toContainText('--primary');
		await expect(codeBlock).toContainText('[data-slot=');

		// Copy button works
		await page.getByRole('button', { name: /copy css/i }).click();
		await expect(page.getByText('Copied!')).toBeVisible({
			timeout: 3000,
		});

		// Verify actual clipboard contents contain valid CSS
		const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
		expect(clipboardText).toContain(':root');
		expect(clipboardText).toContain('--primary');
	});

	test('headless components render in preview', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		const preview = page.locator('[data-testid="theme-preview"]');
		await expect(preview).toBeVisible({ timeout: 10000 });

		await expect(preview.locator('[data-slot="input"]').first()).toBeVisible();
		await expect(preview.locator('[data-slot="checkbox"]')).toBeVisible();
		await expect(preview.locator('[data-slot="tab"]').first()).toBeVisible();
		await expect(preview.locator('[data-slot="accordion"]')).toBeVisible();
	});

	test('interactive preview — tabs clickable', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		const preview = page.locator('[data-testid="theme-preview"]');
		await expect(preview).toBeVisible({ timeout: 10000 });

		const secondTab = preview.getByRole('tab', { name: /security/i });
		await secondTab.click();
		await expect(secondTab).toHaveAttribute('data-state', 'selected', { timeout: 3000 });
	});

	test('has no WCAG 2.1 AA violations (axe-core)', async ({ page }) => {
		await page.goto('/theme-editor');
		await page.waitForLoadState('domcontentloaded');

		await expect(page.locator('[data-testid="theme-controls"]')).toBeVisible({
			timeout: 10000,
		});
		await expect(page.locator('[data-testid="theme-preview"]')).toBeVisible();

		const results = await checkA11y(page);
		expect(
			results.violations,
			`Theme editor has ${results.violations.length} axe violation(s):\n${results.violations
				.map(
					(v) =>
						`  - [${v.impact}] ${v.id}: ${v.description}\n` +
						`    Help: ${v.helpUrl}\n` +
						`    Targets: ${v.nodes.map((n) => n.target.join(', ')).join(' | ')}`,
				)
				.join('\n')}`,
		).toEqual([]);
	});
});
