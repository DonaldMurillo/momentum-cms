import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Click a table row/cell and wait for SPA navigation.
 * Retries the click to handle Angular SSR hydration timing —
 * event bindings may not be attached even though the DOM is rendered.
 */
export async function clickAndWaitForNav(
	locator: Locator,
	page: Page,
	urlPattern: RegExp,
	options?: { timeout?: number },
): Promise<void> {
	const timeout = options?.timeout ?? 15000;
	await expect
		.poll(
			async () => {
				if (urlPattern.test(page.url())) return page.url();
				await locator.click({ timeout: 2000 }).catch(() => undefined);
				return page.url();
			},
			{ timeout, intervals: [500, 1000, 1500, 2000] },
		)
		.toMatch(urlPattern);
}
