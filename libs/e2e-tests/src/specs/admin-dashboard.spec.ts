import { test, expect } from '../fixtures';

/**
 * Admin Dashboard E2E Tests
 *
 * These tests require authentication and use the auth fixture
 * to ensure the user is logged in before each test.
 *
 * The example-config has: Categories, Articles, and other collections.
 * Auth collections (Users, API Keys) are injected by the auth plugin.
 */

test.describe('Admin Dashboard - Collection Grouping', { tag: ['@admin', '@smoke'] }, () => {
	test('should render a section heading for each admin.group', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// The example-config has admin.group: 'Content' on Articles + Categories
		// and the auth plugin contributes an 'Authentication' group
		await expect(
			authenticatedPage.getByRole('heading', { name: 'Content', level: 2 }),
		).toBeVisible();
		await expect(
			authenticatedPage.getByRole('heading', { name: 'Authentication', level: 2 }),
		).toBeVisible();
	});

	test('should render a "Collections" fallback heading for ungrouped collections', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Several example-config collections (products, settings, events, media, etc.)
		// have no explicit admin.group, so the default 'Collections' fallback group appears
		await expect(
			authenticatedPage.getByRole('heading', { name: 'Collections', level: 2 }),
		).toBeVisible();
	});

	test('should place Categories and Articles cards inside the Content group section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// <section aria-labelledby="group-Content"> is a named region
		const contentSection = authenticatedPage.getByRole('region', { name: 'Content' });
		await expect(contentSection).toBeVisible();
		// PR #70 (editorial design lift) replaced heading-based cards with anchor
		// list rows. Title link's accessible name includes the description, so
		// match against the start.
		await expect(contentSection.getByRole('link', { name: /^Categories\b/ })).toBeVisible();
		await expect(contentSection.getByRole('link', { name: /^Articles\b/ })).toBeVisible();
	});

	test('should place Users and Auth Api Keys cards inside the Authentication group section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const authSection = authenticatedPage.getByRole('region', { name: 'Authentication' });
		await expect(authSection).toBeVisible();
		await expect(authSection.getByRole('link', { name: /^Users\b/ })).toBeVisible();
		await expect(authSection.getByRole('link', { name: /^Auth Api Keys\b/ })).toBeVisible();
	});

	test('should NOT show Content collection cards inside the Authentication section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const authSection = authenticatedPage.getByRole('region', { name: 'Authentication' });
		await expect(authSection.getByRole('link', { name: /^Categories\b/ })).toBeHidden();
		await expect(authSection.getByRole('link', { name: /^Articles\b/ })).toBeHidden();
	});

	test('should render the Content group section before the Authentication group section', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const contentHeading = authenticatedPage.getByRole('heading', { name: 'Content', level: 2 });
		const authHeading = authenticatedPage.getByRole('heading', {
			name: 'Authentication',
			level: 2,
		});

		const contentBox = await contentHeading.boundingBox();
		const authBox = await authHeading.boundingBox();

		// Content group must appear above Authentication group in document order
		if (!contentBox || !authBox) {
			throw new Error('Group section headings must be in the viewport to compare positions');
		}
		expect(contentBox.y).toBeLessThan(authBox.y);
	});
});

test.describe('Admin Dashboard', { tag: ['@admin', '@smoke'] }, () => {
	test('should display dashboard with correct heading', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const heading = authenticatedPage.getByRole('heading', { name: 'Dashboard' });
		await expect(heading).toBeVisible();
	});

	test('should display welcome subtitle', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Dashboard subtitle (text was reworded by editorial design lift #70).
		const subtitle = authenticatedPage.getByText(/A snapshot of every collection/i);
		await expect(subtitle).toBeVisible();
	});

	test('should display collection cards for Categories and Articles', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Check collection cards are visible by their labels (anchor list rows since #70).
		// Scope to mcms-collection-card to avoid the sidebar link with the same name.
		const cards = authenticatedPage.locator('mcms-collection-card');
		await expect(cards.getByRole('link', { name: /^Categories\b/ })).toBeVisible();
		await expect(cards.getByRole('link', { name: /^Articles\b/ })).toBeVisible();
	});

	test('should navigate to Articles collection when clicking View all', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Find the Articles card by its title link, then click "Open →"
		const articlesCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('link', { name: /^Articles\b/ }),
		});
		await articlesCard.getByRole('link', { name: /Open/ }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/);
		// The list page DOES use a heading for its title.
		await expect(authenticatedPage.getByRole('heading', { name: 'Articles' })).toBeVisible();
	});

	test('should navigate to Users collection (auth-user) when clicking View all', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Users collection is now auth-user (managed by auth plugin).
		const usersCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('link', { name: /^Users\b/ }),
		});
		await usersCard.getByRole('link', { name: /Open/ }).click();

		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/);
		await expect(authenticatedPage.getByRole('heading', { name: 'Users' })).toBeVisible();
	});

	test('should show numeric count badge on Users card, not error', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const usersCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('link', { name: /^Users\b/ }),
		});
		// The numeric count is rendered as a tabular number span with an aria-label,
		// not via mcms-badge anymore. Match the count container by its aria-label.
		const count = usersCard.locator('[aria-label*="entries in"]').first();
		// Strip whitespace and assert the rendered count is a number, not "—" or "!".
		await expect
			.poll(async () => (await count.textContent())?.trim() ?? '', { timeout: 15000 })
			.toMatch(/^\d[\d,]*$/);
	});

	test('should display Auth API Keys card on dashboard', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const apiKeysCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('link', { name: /^Auth Api Keys\b/ }),
		});
		await expect(apiKeysCard).toBeVisible({ timeout: 15000 });

		const count = apiKeysCard.locator('[aria-label*="entries in"]').first();
		// Strip whitespace and assert the rendered count is a number, not "—" or "!".
		await expect
			.poll(async () => (await count.textContent())?.trim() ?? '', { timeout: 15000 })
			.toMatch(/^\d[\d,]*$/);
	});

	test('should NOT display hidden auth collections as dashboard cards', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Hidden auth collections (auth-session, auth-account, auth-verification)
		// should NOT appear as collection cards on the dashboard. Match by the
		// title link (anchor list rows since #70).
		const sessionCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('link', { name: /^Auth Session\b/ }),
		});
		await expect(sessionCard).toHaveCount(0);

		const accountCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('link', { name: /^Auth Account\b/ }),
		});
		await expect(accountCard).toHaveCount(0);

		const verificationCard = authenticatedPage.locator('mcms-collection-card', {
			has: authenticatedPage.getByRole('link', { name: /^Auth Verification\b/ }),
		});
		await expect(verificationCard).toHaveCount(0);
	});
});

test.describe('Admin Sidebar Navigation', { tag: ['@admin', '@smoke'] }, () => {
	test('should display sidebar with branding title', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Sidebar with branding
		const brandingTitle = authenticatedPage.getByRole('heading', { name: 'Momentum CMS' });
		await expect(brandingTitle).toBeVisible();
	});

	test('should have Dashboard link in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Dashboard link in sidebar navigation (not breadcrumbs)
		const sidebar = authenticatedPage.getByLabel('Main navigation');
		const dashboardLink = sidebar.getByRole('link', { name: 'Dashboard' });
		await expect(dashboardLink).toBeVisible();
	});

	test('should have collection links in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Use sidebar label to avoid conflicts with breadcrumbs
		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Static collections: Categories, Articles
		await expect(sidebar.getByRole('link', { name: 'Categories' })).toBeVisible();
		await expect(sidebar.getByRole('link', { name: 'Articles' })).toBeVisible();
	});

	test('should display Authentication section with auth plugin collections', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Authentication section header (group name from auth collections)
		await expect(sidebar.getByText('Authentication')).toBeVisible();

		// Auth-user collection (labels.plural: 'Users') should be visible
		await expect(sidebar.getByRole('link', { name: 'Users' })).toBeVisible();

		// Auth-api-keys collection (humanized slug: 'Auth Api Keys') should be visible
		await expect(sidebar.getByRole('link', { name: 'Auth Api Keys' })).toBeVisible();
	});

	test('should NOT display hidden auth collections in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Hidden collections (auth-session, auth-account, auth-verification)
		// should NOT appear in the sidebar
		await expect(sidebar.getByRole('link', { name: 'Auth Session' })).toBeHidden();
		await expect(sidebar.getByRole('link', { name: 'Auth Account' })).toBeHidden();
		await expect(sidebar.getByRole('link', { name: 'Auth Verification' })).toBeHidden();
	});

	test('should navigate to Users via Authentication sidebar link', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Click Users in the Authentication section
		await sidebar.getByRole('link', { name: 'Users' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});
	});

	test('should navigate using sidebar links', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Use sidebar label to avoid conflicts with breadcrumbs
		const sidebar = authenticatedPage.getByLabel('Main navigation');

		// Click Articles in sidebar
		await sidebar.getByRole('link', { name: 'Articles' }).click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/articles/, {
			timeout: 10000,
		});

		// Click Dashboard in sidebar (re-query navigation after page change)
		const dashboardLink = authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Dashboard' });
		// Ensure link is visible and stable before clicking
		await expect(dashboardLink).toBeVisible();
		// Use JavaScript navigation as a fallback for Angular router issues.
		// Prefer href-based goto so the click() force-option workaround is never needed.
		const dashboardHref = await dashboardLink.getAttribute('href');
		if (dashboardHref) {
			await authenticatedPage.goto(dashboardHref);
		} else {
			await dashboardLink.click();
		}
		// Wait for navigation to dashboard
		await expect(authenticatedPage).toHaveURL(/\/admin\/?$/, { timeout: 10000 });

		// Click Users in sidebar (now auth-user collection from auth plugin)
		await authenticatedPage
			.getByLabel('Main navigation')
			.getByRole('link', { name: 'Users' })
			.click();
		await expect(authenticatedPage).toHaveURL(/\/admin\/collections\/auth-user/, {
			timeout: 10000,
		});
	});

	test('should display user info in sidebar', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// User info is rendered during SSR via injectUser() reading from MOMENTUM_API_CONTEXT.
		// After hydration, MomentumAuthService initializes and keeps user displayed.
		await expect(authenticatedPage.getByText('Test Admin')).toBeVisible({ timeout: 15000 });
		await expect(authenticatedPage.getByText('admin@test.com')).toBeVisible();
	});
});

test.describe('Admin Sidebar Icons', { tag: ['@admin', '@smoke'] }, () => {
	test('every sidebar nav item renders an SVG icon', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await expect(sidebar).toBeVisible({ timeout: 10000 });

		// Get all nav items (collections, globals, and plugin routes)
		const navItems = sidebar.locator('mcms-sidebar-nav-item');
		const count = await navItems.count();
		expect(count).toBeGreaterThan(5);

		// Every nav item must have an ng-icon that actually rendered an SVG
		const missingIcons: string[] = [];
		for (let i = 0; i < count; i++) {
			const item = navItems.nth(i);
			const label = (await item.locator('span').first().textContent()) ?? `item-${i}`;
			const svgCount = await item.locator('ng-icon svg').count();
			if (svgCount === 0) {
				missingIcons.push(label.trim());
			}
		}

		expect(
			missingIcons,
			`Sidebar items missing rendered SVG icons: ${missingIcons.join(', ')}`,
		).toHaveLength(0);
	});

	test('sidebar icons show visual variety (not all the same fallback)', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		const sidebar = authenticatedPage.getByLabel('Main navigation');
		await expect(sidebar).toBeVisible({ timeout: 10000 });

		// Collect distinct SVG innerHTML from rendered icons to detect variety
		const svgs = sidebar.locator('mcms-sidebar-nav-item ng-icon svg');
		const count = await svgs.count();
		expect(count).toBeGreaterThan(5);

		const distinctSvgs = new Set<string>();
		for (let i = 0; i < count; i++) {
			const html = await svgs.nth(i).innerHTML();
			distinctSvgs.add(html);
		}

		// Expect at least 4 distinct icon shapes (not all heroFolder)
		expect(
			distinctSvgs.size,
			`Only ${distinctSvgs.size} distinct icon shape(s) rendered. Expected visual variety.`,
		).toBeGreaterThanOrEqual(4);
	});
});
