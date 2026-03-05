---
name: e2e-test
description: Write and validate Playwright E2E tests for Momentum CMS features. UI tests start from /admin dashboard and navigate via sidebar — never go directly to deep URLs.
argument-hint: <feature-or-collection-name>
---

# E2E Test Writing Skill

Write Playwright E2E tests for Momentum CMS features. UI tests simulate real user journeys — they **always start from the admin dashboard** and navigate through the actual UI.

## RULE 1: DASHBOARD IS THE STARTING POINT

**Every admin UI test starts at `/admin` (the dashboard) and navigates to the feature via the sidebar or dashboard cards.** This validates that the feature is actually visible and reachable.

### The Navigation Chain

```
/admin (dashboard) → sidebar click → list view → create/view/edit
```

**NEVER do this:**

```typescript
// BAD: Skipping to a deep URL
await page.goto('/admin/collections/posts/new');
```

**ALWAYS do this:**

```typescript
// GOOD: Start from dashboard
await page.goto('/admin');
await page.waitForLoadState('domcontentloaded');

const sidebar = page.getByLabel('Main navigation');
await sidebar.getByRole('link', { name: 'Posts' }).click();
await expect(page).toHaveURL(/\/admin\/collections\/posts$/);

await page.getByRole('button', { name: /Create Post/i }).click();
```

## RULE 2: NEVER WRITE BLIND TESTS

**You MUST see the actual UI before writing any assertions.** Write a probe test that intentionally fails to see the page structure:

```typescript
test('probe: inspect dashboard', async ({ page }) => {
	await page.goto('/admin');
	await page.waitForLoadState('domcontentloaded');
	await expect(page.getByText('XYZZY_WILL_NOT_MATCH')).toBeVisible();
});
```

## Arguments

- `$ARGUMENTS` - Feature/collection to test (e.g., "posts", "settings", "seo dashboard")

## Test File Location

Create test files at:

```
tests/<feature>.spec.ts
```

## Test Setup

```typescript
import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'password123';

test.beforeEach(async ({ page, request }) => {
	// Sign in
	await request.post('/api/auth/sign-in/email', {
		headers: { 'Content-Type': 'application/json' },
		data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
	});
});
```

## Admin UI Test Patterns

### Full Navigation Flow

```typescript
test.describe('Feature Admin UI', () => {
	test('navigate from dashboard to list via sidebar', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForLoadState('domcontentloaded');

		// Navigate via sidebar
		const sidebar = page.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Posts' }).click();
		await expect(page).toHaveURL(/\/admin\/collections\/posts$/);
		await expect(page.getByRole('heading', { name: 'Posts' })).toBeVisible();
	});

	test('create via UI from dashboard', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForLoadState('domcontentloaded');

		const sidebar = page.getByLabel('Main navigation');
		await sidebar.getByRole('link', { name: 'Posts' }).click();

		await page.getByRole('button', { name: /Create Post/i }).click();
		await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible();

		await page.locator('input#field-title').fill('Test Post');
		await page.getByRole('button', { name: 'Create', exact: true }).click();

		await expect(page).toHaveURL(/\/admin\/collections\/posts\/[^/]+$/);
	});
});
```

### Key UI Selectors

| Element         | Selector                                                     |
| --------------- | ------------------------------------------------------------ |
| Sidebar nav     | `getByLabel('Main navigation')`                              |
| Dashboard group | `getByRole('region', { name: 'GroupName' })`                 |
| Text inputs     | `locator('input#field-{fieldName}')`                         |
| Create button   | `getByRole('button', { name: 'Create', exact: true })`       |
| Save button     | `getByRole('button', { name: 'Save Changes' })` (NOT "Save") |
| Edit URL        | `/{id}/edit` (view page is `/{id}`)                          |

## API Test Patterns

```typescript
test.describe('Feature - API', () => {
	test('CRUD operations', async ({ request }) => {
		const create = await request.post('/api/posts', {
			headers: { 'Content-Type': 'application/json' },
			data: { title: 'API Test Post' },
		});
		expect(create.status()).toBe(201);

		const { doc } = (await create.json()) as { doc: { id: string } };

		const get = await request.get(`/api/posts/${doc.id}`);
		expect(get.ok()).toBe(true);

		// Clean up
		await request.delete(`/api/posts/${doc.id}`);
	});
});
```

## Banned Patterns

1. **NO `.catch(() => false/null/{})` on Playwright calls**
2. **NO `waitForTimeout(N)`** — use `expect(locator).toBeVisible({ timeout: N })`
3. **NO ambiguous assertions** — use exact status codes and values
4. **NO direct URL navigation for UI tests** — always start from `/admin`

## Running Tests

```bash
npx playwright test                          # Run all tests
npx playwright test tests/<feature>.spec.ts  # Run specific spec
npx playwright test --grep "test name"       # Run by name
```
