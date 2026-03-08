import { test, expect } from '../fixtures';

test.describe('Headless Styling Lab', { tag: ['@headless', '@styling'] }, () => {
	test('applies global and scoped switch recipes from the app stylesheet', async ({ page }) => {
		await page.goto('/headless-styling-lab');

		const globalSwitch = page.getByTestId('global-switch');
		const scopedSwitch = page.getByTestId('scoped-switch');
		const adhocSwitch = page.getByTestId('adhoc-switch');

		await expect(globalSwitch).toHaveAttribute('data-state', 'unchecked');
		await expect(globalSwitch).toHaveCSS('background-color', 'rgb(255, 237, 213)');

		await globalSwitch.click();
		await scopedSwitch.click();
		await adhocSwitch.click();

		await expect(globalSwitch).toHaveAttribute('data-state', 'checked');
		await expect(globalSwitch).toHaveCSS('background-color', 'rgb(249, 115, 22)');
		await expect(scopedSwitch).toHaveCSS('background-color', 'rgb(219, 39, 119)');
		await expect(adhocSwitch).toHaveCSS('background-color', 'rgb(15, 118, 110)');
		await expect(adhocSwitch).toHaveCSS('border-radius', '16px');
	});

	test('styles tabs through the global slot selectors', async ({ page }) => {
		await page.goto('/headless-styling-lab');

		const overviewTab = page.getByTestId('global-tab-overview');
		const tokensTab = page.getByTestId('global-tab-tokens');
		const scopedBerryTab = page.getByTestId('scoped-tab-berry');
		const scopedContrastTab = page.getByTestId('scoped-tab-contrast');

		await expect(overviewTab).toHaveAttribute('data-state', 'selected');
		await expect(overviewTab).toHaveCSS('background-color', 'rgb(249, 115, 22)');

		await tokensTab.click();
		await expect(tokensTab).toHaveAttribute('data-state', 'selected');
		await expect(tokensTab).toHaveCSS('background-color', 'rgb(249, 115, 22)');

		await scopedContrastTab.click();
		await expect(scopedContrastTab).toHaveAttribute('data-state', 'selected');
		await expect(scopedBerryTab).toHaveAttribute('data-state', 'unselected');
		await expect(scopedContrastTab).toHaveCSS('background-color', 'rgb(219, 39, 119)');
	});

	test('styles dialog, popover, tooltip, and toast overlays from the global layer', async ({
		page,
	}) => {
		await page.goto('/headless-styling-lab');

		await page.getByTestId('dialog-trigger').click();
		const dialog = page.getByTestId('dialog-surface');
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveCSS('border-radius', '28px');
		await expect(page.locator('.hdl-dialog-backdrop')).toHaveCSS(
			'background-color',
			'rgba(15, 23, 42, 0.45)',
		);
		await page.getByTestId('dialog-close').click();
		await expect(dialog).toHaveCount(0);

		await page.getByTestId('popover-trigger').click();
		const popover = page.getByTestId('popover-content');
		await expect(popover).toBeVisible();
		await expect(popover).toHaveCSS('border-radius', '24px');
		await expect(popover).toHaveCSS('background-color', 'rgb(255, 255, 255)');
		await page.keyboard.press('Escape');
		await expect(popover).toHaveCount(0);

		await page.getByTestId('tooltip-trigger').focus();
		const tooltip = page.locator('[data-slot="tooltip-content"]');
		await expect(tooltip).toBeVisible();
		await expect(tooltip).toHaveCSS('background-color', 'rgb(17, 24, 39)');
		await expect(tooltip).toHaveCSS('color', 'rgb(248, 250, 252)');

		await page.getByTestId('toast-trigger').click();
		const toast = page.locator('[data-slot="toast"]').first();
		await expect(toast).toBeVisible();
		await expect(toast).toHaveAttribute('data-variant', 'success');
		await expect(toast).toHaveCSS('background-color', 'rgb(240, 253, 244)');
	});
});
