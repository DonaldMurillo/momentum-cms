import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';

/**
 * Run an axe-core accessibility scan targeting WCAG 2.1 AA on the given page.
 *
 * @param page - Playwright Page to scan
 * @param options - Optional configuration
 * @param options.exclude - CSS selectors to exclude from scanning
 * @returns AxeResults containing any violations found
 */
export async function checkA11y(page: Page, options?: { exclude?: string[] }): Promise<AxeResults> {
	let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

	if (options?.exclude) {
		for (const selector of options.exclude) {
			builder = builder.exclude(selector);
		}
	}

	return builder.analyze();
}
