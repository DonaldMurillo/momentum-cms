---
name: stroll-test
description: End-to-end CLI stroll test of npm-published Momentum CMS packages. Scaffolds a fresh project with create-momentum-app, adds all plugins, runs migrations, starts server, and verifies everything works. Triggers include "stroll test", "cli stroll", "test published packages", or "/stroll-test".
argument-hint: <version> (e.g., 0.5.7, or "latest" for latest published version)
allowed-tools: Bash(*), Read, Glob, Grep, Edit, Write
---

# CLI Stroll Test Skill

Test the real npm-published Momentum CMS developer experience by scaffolding a project from scratch and verifying all plugins work together.

## Inputs

- **version**: Specific version to test (e.g., `0.5.7`), or `latest` (default)
- If no argument provided, default to `latest`

## Overview

This test simulates a real user: `npx create-momentum-app`, install plugins, configure migration mode, generate migrations, run them, start server, verify all collections work via API.

## Step 1: Clean and Scaffold

```bash
rm -rf /tmp/momentum-stroll 2>/dev/null
mkdir -p /tmp/momentum-stroll
cd /tmp/momentum-stroll
echo "y" | npx create-momentum-app@<version> stroll-test --flavor angular --database sqlite
```

Verify:

- Scaffolding completes without errors
- `npm run generate` runs during setup
- Check `node_modules/@momentumcms/core/package.json` to confirm installed version

## Step 2: Install All Plugins

```bash
cd /tmp/momentum-stroll/stroll-test
npm install \
  @momentumcms/plugins-analytics@<version> \
  @momentumcms/plugins-otel@<version> \
  @momentumcms/plugins-email@<version> \
  @momentumcms/plugins-redirects@<version> \
  @momentumcms/plugins-form-builder@<version> \
  @momentumcms/plugins-image@<version> \
  @momentumcms/plugins-queue@<version> \
  @momentumcms/plugins-cron@<version> \
  @momentumcms/queue@<version>
```

Verify:

- All packages install without `ETARGET` or peer dependency errors
- If `@momentumcms/form-builder` fails with version mismatch, that's a known release config issue

## Step 3: Configure All Plugins + Migration Mode

Replace `/tmp/momentum-stroll/stroll-test/src/momentum.config.ts` with a config that:

1. **Enables migration mode**: `db: { adapter: dbAdapter, syncSchema: false }` and `migrations: { mode: 'migrate', directory: './migrations' }`
2. **Adds all plugins**: seo, auth (already scaffolded), analytics, otel, email, redirects, form-builder, image, queue, cron

**Important config notes** (Issue #11 — API mismatches):

- Analytics requires `adapter: new MemoryAnalyticsAdapter()` — import `MemoryAnalyticsAdapter` from `@momentumcms/plugins-analytics`
- Analytics does NOT accept `collections` property
- OTel metrics config: `metrics: { enabled: true, adminDashboard: true }` (not `metrics: true`)
- Image does NOT accept `collections` property
- Queue requires `adapter: new MemoryQueueAdapter()` — import `MemoryQueueAdapter` from `@momentumcms/plugins-queue` (or `@momentumcms/queue`)
- Queue also requires `handlers: {}` (can be empty object for basic testing)
- Cron requires `queue: queuePluginInstance` — pass the queue plugin instance, NOT the adapter

Example config:

```typescript
import { sqliteAdapter } from '@momentumcms/db-drizzle';
import { momentumAuth } from '@momentumcms/auth';
import { localStorageAdapter } from '@momentumcms/storage';
import { seoPlugin } from '@momentumcms/plugins-seo';
import { analyticsPlugin, MemoryAnalyticsAdapter } from '@momentumcms/plugins-analytics';
import { otelPlugin } from '@momentumcms/plugins-otel';
import { emailPlugin } from '@momentumcms/plugins-email';
import { redirectsPlugin } from '@momentumcms/plugins-redirects';
import { formBuilderPlugin } from '@momentumcms/plugins-form-builder';
import { imagePlugin } from '@momentumcms/plugins-image';
import { queuePlugin, MemoryQueueAdapter } from '@momentumcms/plugins-queue';
import { cronPlugin } from '@momentumcms/plugins-cron';
import { defineMomentumConfig } from '@momentumcms/core';
import { join } from 'node:path';
import { Posts } from './collections/posts.collection';

const dbAdapter = sqliteAdapter({
	filename: process.env['DATABASE_PATH'] ?? './data/stroll-test.db',
});

const PORT = Number(process.env['PORT']) || 4200;
const BASE_URL = process.env['BETTER_AUTH_URL'] || `http://localhost:${PORT}`;

export const authPlugin = momentumAuth({
	db: { type: 'sqlite', database: dbAdapter.getRawDatabase() },
	baseURL: BASE_URL,
	trustedOrigins: [BASE_URL],
});

const queue = queuePlugin({
	adapter: new MemoryQueueAdapter(),
	handlers: {},
});

const config = defineMomentumConfig({
	db: { adapter: dbAdapter, syncSchema: false },
	migrations: { mode: 'migrate', directory: './migrations' },
	collections: [Posts],
	storage: {
		adapter: localStorageAdapter({
			directory: join(process.cwd(), 'data', 'uploads'),
		}),
	},
	admin: { basePath: '/admin', branding: { title: 'stroll-test' } },
	server: {
		port: PORT,
		cors: {
			origin: '*',
			methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
			headers: ['Content-Type', 'Authorization', 'X-API-Key'],
		},
	},
	logging: { level: 'info', format: 'pretty' },
	plugins: [
		seoPlugin({
			collections: ['posts'],
			siteUrl: BASE_URL,
			analysis: true,
			sitemap: true,
			robots: true,
			metaApi: true,
			adminDashboard: true,
		}),
		authPlugin,
		analyticsPlugin({
			adapter: new MemoryAnalyticsAdapter(),
			trackApi: true,
			trackPageViews: true,
		}),
		otelPlugin({ metrics: { enabled: true, adminDashboard: true } }),
		emailPlugin({}),
		redirectsPlugin({}),
		formBuilderPlugin({}),
		imagePlugin({}),
		queue,
		cronPlugin({ queue }),
	],
});

export default config;
```

## Step 4: Regenerate Types

```bash
cd /tmp/momentum-stroll/stroll-test && npm run generate
```

Verify: Types and admin config generated without errors.

## Step 5: Generate and Run Migrations

```bash
cd /tmp/momentum-stroll/stroll-test
npm run migrate:generate
npm run migrate:run
npm run migrate:status
```

Verify:

- Migration detects all expected tables (should be ~14: posts, user, session, account, verification, \_api_keys, tracking-rules, otel-snapshots, email-templates, redirects, forms, form-submissions, queue-jobs, cron-schedules)
- Migration applies cleanly (batch 1, 0 failed)
- Status shows all applied, 0 pending

## Step 6: Test Migration Rollback + Re-apply

```bash
cd /tmp/momentum-stroll/stroll-test
npm run migrate:rollback
npm run migrate:status   # Should show 0 applied, 1 pending
npm run migrate:run
npm run migrate:status   # Should show 1 applied, 0 pending
```

## Step 7: Start Server and Verify

Kill any process on port 4200 first:

```bash
lsof -ti:4200 2>/dev/null | xargs kill -9 2>/dev/null
sleep 2
```

Start the dev server in background:

```bash
cd /tmp/momentum-stroll/stroll-test && npm run dev > /tmp/momentum-stroll/dev.log 2>&1 &
```

Wait for server ready (poll `http://localhost:4200/api/health` or wait ~20 seconds).

### 7a. Check startup errors

```bash
grep -iE "error|FATAL|crash" /tmp/momentum-stroll/dev.log | grep -v "angular-errors|deprecated|MaxListeners|trace-|stderr|Vite|vite-ignore|above dynamic|HMR"
```

Should return nothing (0 errors).

### 7b. Sign up first user

```bash
curl -s -X POST http://localhost:4200/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"Test123456","name":"Admin"}'
```

Verify: Response includes `"role":"admin"` (first user auto-promotion).

### 7c. Sign in and get session cookie

```bash
COOKIE=$(curl -s -D - -X POST http://localhost:4200/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.com","password":"Test123456"}' 2>&1 | grep -i 'set-cookie' | head -1 | sed 's/.*set-cookie: //i' | sed 's/;.*//')
```

### 7d. Verify all collections accessible

Test each collection via GET `/api/<slug>`:

```
posts, redirects, forms, form-submissions, email-templates,
tracking-rules, auth-user, auth-session, auth-api-keys, otel-snapshots,
queue-jobs, cron-schedules
```

Each should return `{ totalDocs: <number>, ... }` (not 403 or 500).

### 7e. Test CRUD operations

Create a document in each plugin collection:

- POST `/api/posts` — `{"title":"Test","slug":"test"}`
- POST `/api/redirects` — `{"from":"/old","to":"/new","type":"permanent"}`
- POST `/api/forms` — `{"title":"Contact","slug":"contact","status":"published","schema":{"fields":[]}}`
- POST `/api/email-templates` — `{"name":"Welcome","slug":"welcome","subject":"Welcome"}`
- POST `/api/tracking-rules` — `{"name":"CTA","selector":".cta","eventType":"click","eventName":"cta_click","urlPattern":"*","active":true}`

Each should return `{ doc: {...}, status: 201 }`.

### 7f. Test SEO endpoints

```bash
curl -s http://localhost:4200/sitemap.xml | head -3
curl -s http://localhost:4200/robots.txt
```

Both should return valid XML/text.

### 7g. Test admin UI loads

```bash
curl -s http://localhost:4200/admin | head -3
```

Should return `<!doctype html>`.

## Step 8: Cleanup

```bash
lsof -ti:4200 2>/dev/null | xargs kill -9 2>/dev/null
```

## Step 9: Report

Update `docs/cli-stroll-issues.md` with results. For each check, note:

- PASS or FAIL
- If FAIL: error message, affected plugin, severity

Create a summary table:

| Check                          | Result    |
| ------------------------------ | --------- |
| Scaffold                       | PASS/FAIL |
| Install plugins                | PASS/FAIL |
| Generate types                 | PASS/FAIL |
| Generate migration             | PASS/FAIL |
| Run migration                  | PASS/FAIL |
| Rollback + re-apply            | PASS/FAIL |
| Server starts (0 errors)       | PASS/FAIL |
| First user gets admin          | PASS/FAIL |
| All 12 collections accessible  | PASS/FAIL |
| CRUD on all plugin collections | PASS/FAIL |
| SEO sitemap + robots           | PASS/FAIL |
| Admin UI loads                 | PASS/FAIL |

## Known Issues to Watch For

- **form-builder ETARGET**: If `@momentumcms/form-builder@<version>` doesn't exist, the `form-builder` project.json may have a `manifestRootsToUpdate` override that excludes source. Check `libs/form-builder/project.json`.
- **Config API mismatches**: Analytics requires `adapter`, OTel requires `metrics: { enabled: true }`, Image has no `collections`. If the scaffolded templates show different APIs, that's Issue #11.
- **Vite SSR warnings**: "The above dynamic import cannot be analyzed by Vite" — cosmetic only, plugins work.
- **Port 4200 in use**: Always kill before starting. The Angular CLI doesn't recover gracefully from port conflicts.

## All Plugins Tested

All 9 user-facing plugins are tested by this skill: SEO, Auth, Analytics, OTel, Email, Redirects, Form Builder, Image, Queue, and Cron.
