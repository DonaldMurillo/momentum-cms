import { expect, test } from '../fixtures/public';

const inventorySlugs = [
	'field',
	'input',
	'textarea',
	'chips',
	'collapsible',
	'toggle',
	'toggle-group',
	'select',
	'command',
	'separator',
	'progress',
	'spinner',
	'skeleton',
	'switch',
	'tabs',
	'dialog',
	'popover',
	'tooltip',
	'toast',
	'accordion',
	'checkbox',
	'radio-group',
	'listbox',
	'combobox',
	'tree',
	'grid',
	'menu',
	'menu-bar',
	'toolbar',
	'context-menu',
	'hover-card',
	'alert-dialog',
	'drawer',
] as const;

test.describe('Headless Styling Lab', { tag: ['@headless', '@styling'] }, () => {
	test.setTimeout(120_000);

	test('shows the full primitive inventory before the demos and renders every slot family', async ({
		page,
	}) => {
		test.slow();
		await page.goto('/headless-styling-lab');
		await expect.poll(async () => page.locator('[data-slot]').count()).toBeGreaterThan(100);

		await expect(page.getByTestId('primitive-coverage-card')).toBeVisible();
		await expect(page.getByTestId('lab-theme-state')).toContainText('light');
		await expect(page.getByTestId('coverage-current-scope')).toContainText(
			'Form foundations are part of the exported surface now too',
		);
		expect(await page.locator('[data-testid^="inventory-"]').count()).toBe(inventorySlugs.length);

		for (const slug of inventorySlugs) {
			const inventoryItem = page.getByTestId(`inventory-${slug}`);
			expect(await inventoryItem.count()).toBe(1);
			expect(await inventoryItem.getAttribute('href')).toBeNull();
		}

		for (const slot of [
			'accordion',
			'accordion-item',
			'accordion-trigger',
			'accordion-content',
			'field',
			'label',
			'description',
			'error',
			'input',
			'textarea',
			'chips',
			'chip',
			'chip-input',
			'chip-remove',
			'collapsible',
			'collapsible-trigger',
			'collapsible-content',
			'toggle',
			'toggle-group',
			'toggle-item',
			'select',
			'select-trigger',
			'select-value',
			'select-content',
			'select-item',
			'command',
			'command-input',
			'command-list',
			'command-group',
			'command-item',
			'command-separator',
			'command-dialog',
			'separator',
			'progress',
			'spinner',
			'skeleton',
			'checkbox',
			'radio-group',
			'radio-item',
			'listbox',
			'option',
			'combobox',
			'combobox-input',
			'combobox-popup',
			'grid',
			'grid-row',
			'grid-cell',
			'tree',
			'tree-item',
			'tree-item-group',
			'menu-bar',
			'menu',
			'menu-item',
			'menu-trigger',
			'toolbar',
			'toolbar-widget-group',
			'toolbar-widget',
			'switch',
			'tabs',
			'tab-list',
			'tab',
			'tab-panel',
			'popover-trigger',
			'context-menu-trigger',
			'hover-card-trigger',
			'tooltip-trigger',
			'toast-container',
		]) {
			expect(await page.locator(`[data-slot="${slot}"]`).count()).toBeGreaterThan(0);
		}

		await expect(page.getByTestId('global-recipes-card')).toBeVisible();
		await expect(page.getByTestId('form-foundations-card')).toBeVisible();
		await expect(page.getByTestId('selection-primitives-card')).toBeVisible();
		await expect(page.getByTestId('navigation-primitives-card')).toBeVisible();
		await expect(page.getByTestId('utility-primitives-card')).toBeVisible();
		await expect(page.getByTestId('overlay-primitives-card')).toBeVisible();
		await expect(page.getByTestId('toast-status-card')).toBeVisible();
	});

	test('exercises the form foundation primitives with visible semantics and value readouts', async ({
		page,
	}) => {
		await page.goto('/headless-styling-lab');

		const fieldInput = page.getByTestId('field-input');
		await expect(page.getByTestId('field-error')).toBeVisible();
		const descriptionId = await page.getByTestId('field-description').getAttribute('id');
		const errorId = await page.getByTestId('field-error').getAttribute('id');
		await expect(fieldInput).toHaveAttribute('aria-invalid', 'true');
		await expect(fieldInput).toHaveAttribute('aria-describedby', `${descriptionId} ${errorId}`);
		await fieldInput.fill('Dom');
		await expect(page.getByTestId('field-state')).toContainText('Dom');
		await expect(page.getByTestId('field-error')).toHaveCount(0);
		await expect(fieldInput).not.toHaveAttribute('aria-invalid', 'true');

		const textarea = page.getByTestId('textarea-input');
		await expect(textarea).toHaveAttribute('data-slot', 'textarea');
		await textarea.fill('Review the headline hierarchy before launch.');
		await expect(page.getByTestId('textarea-state')).toContainText('44');

		const chipsInput = page.getByTestId('chips-input');
		await chipsInput.fill('filters');
		await chipsInput.press('Enter');
		await expect(page.getByTestId('chips-state')).toContainText('angular, headless, cms, filters');
		await chipsInput.press('Backspace');
		await expect(page.getByTestId('chips-state')).toContainText('angular, headless, cms');
		await page.getByRole('button', { name: 'Remove angular' }).click();
		await expect(page.getByTestId('chips-state')).toContainText('headless, cms');
	});

	test('supports theme switching plus global, scoped, and ad hoc recipe behavior', async ({
		page,
	}) => {
		await page.goto('/headless-styling-lab');

		const scopedCard = page.getByTestId('scoped-override-card');
		const globalSwitch = page.getByTestId('global-switch');
		const scopedSwitch = page.getByTestId('scoped-switch');
		const adhocSwitch = page.getByTestId('adhoc-switch');
		const adhocThumb = adhocSwitch.locator('.headless-thumb');
		const initialCardBg = await scopedCard.evaluate(
			(node) => getComputedStyle(node).backgroundColor,
		);
		const initialThumbTransform = await adhocThumb.evaluate(
			(node) => getComputedStyle(node).transform,
		);

		await page.getByTestId('lab-theme-toggle').click();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await expect(page.getByTestId('lab-theme-state')).toContainText('dark');
		await expect
			.poll(async () => scopedCard.evaluate((node) => getComputedStyle(node).backgroundColor))
			.not.toBe(initialCardBg);

		await globalSwitch.click();
		await scopedSwitch.click();
		await adhocSwitch.click();

		await expect(globalSwitch).toHaveAttribute('data-state', 'checked');
		await expect(scopedSwitch).toHaveAttribute('data-state', 'checked');
		await expect(adhocSwitch).toHaveAttribute('data-state', 'checked');
		await expect(page.getByTestId('global-switch-state')).toContainText('on');
		await expect(page.getByTestId('scoped-switch-state')).toContainText('on');
		await expect(page.getByTestId('adhoc-switch-state')).toContainText('on');
		await expect(adhocSwitch).toHaveCSS('border-radius', '16px');
		await expect
			.poll(async () => adhocThumb.evaluate((node) => getComputedStyle(node).transform))
			.not.toBe(initialThumbTransform);

		await page.getByTestId('global-tab-tokens').click();
		await expect(page.getByTestId('global-tab-selection')).toContainText('tokens');
		await expect(page.getByTestId('global-tab-panel-overview')).toHaveAttribute('hidden', '');
		await expect(page.getByTestId('global-tab-panel-tokens')).not.toHaveAttribute('hidden', '');

		await page.getByTestId('scoped-tab-contrast').click();
		await expect(page.getByTestId('scoped-tab-contrast')).toHaveAttribute('data-state', 'selected');
		await expect(page.getByTestId('scoped-tab-panel-contrast')).not.toHaveAttribute('hidden', '');
		await expect(page.getByTestId('scoped-tab-panel-berry')).toHaveAttribute('hidden', '');
	});

	test('exercises the selection primitives with visible state readouts', async ({ page }) => {
		await page.goto('/headless-styling-lab');

		const contractTrigger = page.getByTestId('accordion-trigger-contract');
		const contractContent = page.getByTestId('accordion-content-contract');
		await expect(contractContent).toHaveAttribute('hidden', '');
		await contractTrigger.click();
		await expect(contractContent).not.toHaveAttribute('hidden', '');
		await contractTrigger.click();
		await expect(contractContent).toHaveAttribute('hidden', '');

		await expect(page.getByTestId('checkbox-indeterminate')).toHaveAttribute(
			'data-state',
			'indeterminate',
		);
		await page.getByTestId('checkbox-default').click();
		await page.getByTestId('checkbox-featured').click();
		await expect(page.getByTestId('checkbox-state')).toContainText('publish ready yes');
		await expect(page.getByTestId('checkbox-state')).toContainText('featured no');

		await page.getByTestId('radio-density-minimal').click();
		await expect(page.getByTestId('radio-density-state')).toContainText('minimal');

		await page.getByTestId('listbox-option-states').click();
		await expect(page.getByTestId('listbox-option-tokens')).toHaveAttribute(
			'data-state',
			'unselected',
		);
		await expect(page.getByTestId('listbox-option-states')).toHaveAttribute(
			'data-state',
			'selected',
		);
		await expect(page.getByTestId('listbox-selection')).toContainText('states');
		await page.getByTestId('listbox-option-overlays').click();
		await expect(page.getByTestId('listbox-option-overlays')).toHaveAttribute(
			'data-state',
			'selected',
		);
		await expect(page.getByTestId('listbox-selection')).toContainText('overlays');

		const comboboxOptions = page.locator('[data-testid^="combobox-option-"]');
		const initialFilterState = page.getByTestId('combobox-filter-state');
		await expect(initialFilterState).toContainText('all primitives');
		const initialFilterText = await initialFilterState.textContent();
		const initialMatches = Number(initialFilterText?.match(/Matches:\s*(\d+)/)?.[1] ?? NaN);
		expect(initialMatches).toBeGreaterThan(0);
		await expect(comboboxOptions).toHaveCount(initialMatches);
		await page.getByTestId('combobox-input').fill('menu');
		await expect(page.getByTestId('combobox-filter-state')).toContainText('Matches: 3');
		await expect(page.getByTestId('combobox-option-context-menu')).toBeVisible();
		await expect(page.getByTestId('combobox-option-menu')).toBeVisible();
		await expect(page.getByTestId('combobox-option-menu-bar')).toBeVisible();
		await expect(page.getByTestId('combobox-option-dialog')).toHaveCount(0);
		await page.getByTestId('combobox-option-menu-bar').click();
		await expect(page.getByTestId('combobox-selection')).toContainText('menu-bar');
		await expect(page.getByTestId('combobox-input')).toHaveValue('Menu Bar');
		await page.getByTestId('combobox-input').fill('zzzz');
		await expect(page.getByTestId('combobox-empty')).toBeVisible();
		await expect(page.getByTestId('combobox-filter-state')).toContainText('Matches: 0');
	});

	test('exercises the navigation and data primitives instead of leaving them decorative', async ({
		page,
	}) => {
		await page.goto('/headless-styling-lab');

		await expect(page.getByTestId('tree-selection')).toContainText('settings');
		await expect(page.getByTestId('tree-group-content')).toBeVisible();
		await page.getByTestId('tree-item-media').click();
		await expect(page.getByTestId('tree-item-media')).toHaveAttribute('data-state', 'selected');
		await expect(page.getByTestId('tree-selection')).toContainText('media');

		await page.getByTestId('grid-cell-post').click();
		await expect(page.getByTestId('grid-cell-post')).toHaveAttribute('data-state', 'selected');
		await expect(page.getByTestId('grid-selection')).toContainText('launch plan');
		await page.getByTestId('grid-cell-published').click();
		await expect(page.getByTestId('grid-selection')).toContainText('published');

		await page.getByTestId('menu-bar-media').click();
		await expect(page.getByTestId('menu-bar-selection')).toContainText('media');
		await page.getByTestId('menu-bar-settings').click();
		await expect(page.getByTestId('menu-bar-selection')).toContainText('settings');

		await page.getByTestId('menu-trigger').click();
		await expect(page.getByTestId('menu-demo')).toHaveAttribute('data-state', 'open');
		await expect(page.getByTestId('menu-trigger')).toHaveAttribute('role', 'button');
		await page.getByTestId('menu-item-rename').click();
		await expect(page.getByTestId('menu-last-action')).toContainText('rename');
		await page.getByTestId('menu-trigger').click();
		await expect(page.getByTestId('menu-item-delete')).toHaveAttribute('data-disabled', 'true');
		await expect(page.getByTestId('menu-item-delete')).toHaveAttribute('aria-disabled', 'true');
		await expect(page.getByTestId('menu-last-action')).toContainText('rename');

		await page.getByTestId('toolbar-italic').click();
		await page.getByTestId('toolbar-underline').click();
		await expect(page.getByTestId('toolbar-italic')).toHaveAttribute('data-state', 'selected');
		await expect(page.getByTestId('toolbar-underline')).toHaveAttribute('data-state', 'selected');
		await expect(page.getByTestId('toolbar-selection')).toContainText('bold');
		await expect(page.getByTestId('toolbar-selection')).toContainText('italic');
		await expect(page.getByTestId('toolbar-selection')).toContainText('underline');
	});

	test('exercises the utility primitives with visible outcomes instead of dead markup', async ({
		page,
	}) => {
		await page.goto('/headless-styling-lab');

		await expect(page.getByTestId('collapsible-state')).toContainText('closed');
		await page.getByTestId('collapsible-trigger').click();
		await expect(page.getByTestId('collapsible-content')).not.toHaveAttribute('hidden', '');
		await expect(page.getByTestId('collapsible-state')).toContainText('open');

		await page.getByTestId('solo-toggle').click();
		await page.getByTestId('toggle-item-italic').click();
		await page.getByTestId('toggle-item-underline').click();
		await expect(page.getByTestId('toggle-state')).toContainText('on');
		await expect(page.getByTestId('toggle-state')).toContainText('italic');
		await expect(page.getByTestId('toggle-state')).toContainText('underline');

		await page.getByTestId('select-trigger').click();
		await expect(page.getByTestId('select-content')).not.toHaveAttribute('hidden', '');
		await expect(page.getByTestId('select-item-draft')).toHaveCSS('display', 'block');
		await page.getByTestId('select-item-published').click();
		await expect(page.getByTestId('select-state')).toContainText('published');
		await expect(page.getByTestId('select-trigger')).toContainText('Published');
		await expect(page.getByTestId('select-content')).toHaveAttribute('hidden', '');

		await expect(page.getByTestId('command-group-content-label')).toHaveText('Content tools');
		await expect(page.getByTestId('command-group-people-label')).toHaveText('People');
		await expect(page.getByTestId('command-separator')).toHaveCSS('display', 'block');
		await page.getByTestId('command-input').fill('auth');
		await expect(page.getByTestId('command-item-articles')).not.toBeVisible();
		await expect(page.getByTestId('command-item-authors')).toBeVisible();
		await page.getByTestId('command-item-authors').click();
		await expect(page.getByTestId('command-state')).toContainText('authors');
		await page.getByTestId('command-input').fill('');

		await page.getByTestId('progress-advance').click();
		await page.getByTestId('progress-advance').click();
		await page.getByTestId('progress-advance').click();
		await expect(page.getByTestId('progress-state')).toContainText('100%');
		await expect(page.getByTestId('spinner-demo')).toHaveAttribute('data-state', 'inactive');

		await expect(page.getByTestId('skeleton-demo')).toBeVisible();
		await page.getByTestId('skeleton-toggle').click();
		await expect(page.getByTestId('skeleton-loaded-card')).toBeVisible();
	});

	test('proves the overlay primitives work from the global layer instead of just existing on the page', async ({
		page,
	}) => {
		await page.goto('/headless-styling-lab');

		await page.getByTestId('dialog-trigger').click();
		const dialog = page.getByTestId('dialog-surface');
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveCSS('border-radius', '28px');
		await expect(page.locator('.hdl-dialog-backdrop')).toBeVisible();
		await page.getByTestId('dialog-close').click();
		await expect(dialog).toHaveCount(0);

		await page.getByTestId('popover-trigger').click();
		const popover = page.getByTestId('popover-content');
		await expect(popover).toBeVisible();
		await expect(popover).toHaveCSS('border-radius', '24px');
		await page.keyboard.press('Escape');
		await expect(popover).toHaveCount(0);

		await page.getByTestId('tooltip-trigger').hover();
		const tooltip = page.locator('[data-slot="tooltip-content"]');
		await expect(tooltip).toBeVisible();
		await expect(tooltip).toHaveCSS('background-color', 'rgb(17, 24, 39)');

		await page.getByTestId('context-menu-target').click({ button: 'right' });
		await expect(page.getByTestId('context-menu-content')).toBeVisible();
		await page.getByTestId('context-action-archive').click();
		await expect(page.getByTestId('context-menu-state')).toContainText('archive');
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('context-menu-content')).toHaveCount(0);

		await page.getByTestId('hover-card-trigger').hover();
		await expect(page.getByTestId('hover-card-content')).toBeVisible();

		await page.getByTestId('alert-dialog-trigger').click();
		await expect(page.getByTestId('alert-dialog-surface')).toBeVisible();
		await page.getByTestId('alert-cancel').click();
		await expect(page.getByTestId('alert-dialog-surface')).toHaveCount(0);

		await page.getByTestId('drawer-trigger').click();
		const drawer = page.getByTestId('drawer-surface');
		await expect(drawer).toBeVisible();
		await expect(page.locator('.hdl-drawer-panel--right')).toBeVisible();
		await expect(drawer).toHaveAttribute('data-side', 'right');
		const drawerBox = await drawer.boundingBox();
		expect(drawerBox).not.toBeNull();
		const viewport = page.viewportSize();
		expect(viewport).not.toBeNull();
		if (drawerBox && viewport) {
			expect(drawerBox.height).toBeGreaterThan(viewport.height - 32);
			expect(drawerBox.x + drawerBox.width).toBeGreaterThan(viewport.width - 24);
		}
		await page.getByTestId('drawer-close').click();
		await expect(page.getByTestId('drawer-surface')).toHaveCount(0);

		// Command Dialog (⌘K palette)
		await page.getByTestId('command-dialog-trigger').click();
		const cmdPanel = page.locator('[data-slot="command-dialog-panel"]');
		await expect(cmdPanel).toBeVisible();
		await expect(page.locator('.hdl-command-dialog-backdrop')).toBeVisible();

		// Verify the panel has proper width (should fill overlay pane ~640px)
		const cmdBox = await cmdPanel.boundingBox();
		expect(cmdBox).not.toBeNull();
		if (cmdBox) {
			expect(cmdBox.width).toBeGreaterThan(400);
		}

		// Verify input is focused and has correct ARIA
		const cmdInput = page.getByTestId('command-dialog-input');
		await expect(cmdInput).toBeFocused();
		await expect(cmdInput).toHaveAttribute('role', 'combobox');
		await expect(cmdInput).toHaveAttribute('aria-expanded', 'true');

		// All items visible initially
		await expect(cmdPanel.locator('[data-slot="command-item"]')).toHaveCount(6);

		// Filter works visually — hidden items disappear
		await cmdInput.fill('dash');
		const dashItem = cmdPanel
			.locator('[data-slot="command-item"]')
			.filter({ hasText: 'Dashboard' });
		const settingsItem = cmdPanel
			.locator('[data-slot="command-item"]')
			.filter({ hasText: 'Settings' });
		await expect(dashItem).toBeVisible();
		await expect(settingsItem).not.toBeVisible();

		// Clear and navigate with keyboard
		await cmdInput.fill('');
		await expect(cmdPanel.locator('[data-slot="command-item"]:not([hidden])')).toHaveCount(6);

		// ArrowDown highlights first item
		await page.keyboard.press('ArrowDown');
		const firstItem = cmdPanel.locator('[data-slot="command-item"]').first();
		await expect(firstItem).toHaveAttribute('data-active', 'true');
		await expect(cmdInput).toHaveAttribute(
			'aria-activedescendant',
			(await firstItem.getAttribute('id')) ?? '',
		);

		// Enter selects the active item and closes the dialog
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('command-dialog-state')).toContainText('dashboard');
		await expect(cmdPanel).toHaveCount(0);

		// Escape closes the dialog
		await page.getByTestId('command-dialog-trigger').click();
		await expect(cmdPanel).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(cmdPanel).toHaveCount(0);

		// ⌘K shortcut opens the dialog
		await page.keyboard.press('Meta+k');
		await expect(cmdPanel).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(cmdPanel).toHaveCount(0);

		await page.getByTestId('toast-trigger').click();
		const toast = page.locator('[data-slot="toast"]').first();
		await expect(toast).toBeVisible();
		await expect(toast).toHaveAttribute('data-variant', 'success');
		await expect(toast).toHaveCSS('width', '384px');
		await expect(toast.getByText('Theme saved')).toBeVisible();
		await expect(toast.getByText('Global recipes and overrides are active.')).toBeVisible();
		await toast.getByText('Undo').click();
		await expect(page.getByTestId('toast-last-action')).toContainText('undo');
		await toast.getByText('Dismiss').click();
		await expect(toast).toHaveCount(0);
	});

	test('links to the lab from the public showcase page', async ({ page }) => {
		await page.goto('/showcase');

		const heroLink = page.getByTestId('hero-cta');
		await expect(heroLink).toHaveAttribute('href', '/headless-styling-lab');
		await heroLink.click();
		await expect(page).toHaveURL(/\/headless-styling-lab$/);
		await expect(page.getByTestId('primitive-coverage-card')).toBeVisible();
	});
});
