# CLI Stroll Test Issues

Tested `npx create-momentum-app@0.5.5` and re-tested with `0.5.6` with Angular + Express + SQLite on 2026-03-10.

## Blocker Issues

### 1. Migration schematics reference wrong CLI path

**Severity**: Blocker
**Affected**: `@momentumcms/migrations` (all 4 schematics)
**Description**: All migration schematics reference `node_modules/@momentumcms/migrations/cli/*.cjs` but the published package has these files at `node_modules/@momentumcms/migrations/src/cli/*.cjs`.
**Repro**: `npm run migrate:generate` → `ERR_MODULE_NOT_FOUND`
**Files**: `libs/migrations/schematics/{generate,run,rollback,status}/index.ts`
**Fix**: Change `cli/` to `src/cli/` in all schematic paths. **FIXED in 0.5.6.**

### 2. Database adapters missing `queryRaw` and `executeRaw` methods

**Severity**: Blocker
**Affected**: `@momentumcms/db-drizzle` (both SQLite and PostgreSQL adapters)
**Description**: The migration runner requires `queryRaw()` and `executeRaw()` on the DatabaseAdapter, but neither adapter implements them.
**Repro**: `npm run migrate:run` → `DatabaseAdapter must implement queryRaw and executeRaw for migration tracking`
**Files**: `libs/db-drizzle/src/lib/db-drizzle.ts`, `libs/db-drizzle/src/lib/db-postgres.ts`
**Fix**: Added `queryRaw`, `executeRaw`, and `introspect` to SQLite adapter; `queryRaw` and `executeRaw` to PostgreSQL adapter. **FIXED in 0.5.6.**

### 3. `@momentumcms/form-builder` not published at 0.5.5

**Severity**: Blocker
**Affected**: `@momentumcms/plugins-form-builder`
**Description**: `@momentumcms/plugins-form-builder` depends on `@momentumcms/form-builder@0.5.5` but only version 0.5.3 exists on npm. Installation fails with `ETARGET`.
**Repro**: `npm install @momentumcms/plugins-form-builder` → `No matching version found for @momentumcms/form-builder@0.5.5`
**Fix**: Nx Release skipped this Angular library during version bump (source stayed at 0.5.3 while all other packages went to 0.5.6). Manually published 0.5.6. **Root cause**: Need to investigate why `@nx/angular:package` libraries are skipped by `nx release`. **FIXED manually for 0.5.6.**

## Major Issues

### 4. Migration generator ignores plugin-injected collections

**Severity**: ~~Major~~ Fixed
**Affected**: `@momentumcms/migrations` CLI
**Description**: `collectionsToSchema()` in the migration generator only reads `config.collections` (explicitly declared collections). Collections added by plugins via `modifyCollections()` or pushed during `onInit` are not included. Plugin tables (tracking-rules, email-templates, redirects, otel-snapshots, etc.) cannot get migrations generated.
**Repro**: Add analytics plugin → `npm run migrate:generate` → "Schema up to date" (even though tracking-rules collection was added)
**Files**: `libs/migrations/src/cli/generate.ts:43`
**Impact**: Users must use `syncSchema: true` for plugin tables, defeating the migration system's purpose.
**Fix**: Added `mergePluginCollections()` to shared.ts that reads static `plugin.collections` and calls `plugin.modifyCollections()`. Added static `collections` property to analytics and otel plugins. **FIXED in this branch.**

### 5. Auth tables not managed by migration system

**Severity**: ~~Major~~ Fixed
**Affected**: `@momentumcms/auth` + migrations
**Description**: When `syncSchema: false` and `migrations.mode: 'migrate'`, Better Auth tables (user, session, account, verification) are never created. Auth signup/signin returns 500. Better Auth manages its own schema but relies on the server's auto-sync to trigger table creation.
**Repro**: Scaffold with `syncSchema: false` → `npm run migrate:run` → start server → POST `/api/auth/sign-up/email` → 500
**Impact**: Users cannot use strict migration mode without manually creating auth tables.
**Fix**: Resolved by Issue #4 fix — auth plugin already had static `collections` property, so `mergePluginCollections()` now includes auth tables (user, session, account, verification, \_api_keys) in migration generation. **FIXED in this branch.**

### 6. Missing admin-routes `.d.ts` files for 4 plugins

**Severity**: Major
**Affected**: `@momentumcms/plugins-email`, `@momentumcms/plugins-cron`, `@momentumcms/plugins-queue`, `@momentumcms/plugins-form-builder`
**Description**: These plugins declare `./admin-routes` sub-path exports with types pointing to `.d.ts` files that don't exist in the published package. The generated admin config imports these, causing TS compilation failures.
**Repro**: Add email plugin → `npm run generate` → `npm run dev` → `TS7016: Could not find a declaration file for module '@momentumcms/plugins-email/admin-routes'`
**Files**: Each plugin needs a handwritten `*-admin-routes.d.ts` alongside its `.ts` source.
**Fix**: Created `.d.ts` files for email, cron, queue, and form-builder. **FIXED in 0.5.6.**

### 7. Image plugin crashes Vite dev server

**Severity**: ~~Major~~ Fixed
**Affected**: `@momentumcms/plugins-image`
**Description**: The image plugin uses `@napi-rs/image` which includes native `.node` binary files. Vite's esbuild dependency optimizer cannot handle `.node` files, crashing the dev server.
**Repro**: Add image plugin to config → `npm run dev` → `No loader is configured for ".node" files`
**Fix**: Added `"@napi-rs/image"` to `externalDependencies` in the CLI scaffolding template for all flavors. **FIXED in this branch.**

### 13. Collection slug-to-table mapping breaks in migration mode

**Severity**: ~~Major~~ Fixed
**Affected**: `@momentumcms/db-drizzle` (both SQLite and PostgreSQL adapters)
**Description**: When `syncSchema: false` (migration mode), `adapter.initialize()` is never called. This method was responsible for building the `tableNameMap` (slug → DB table name mapping). Collections with `dbName` different from their slug (e.g., `auth-user` → `user`, `auth-session` → `session`) fail with "no such table: auth-user" because `resolveTableName()` falls back to the slug.
**Repro**: Set `syncSchema: false` → `npm run dev` → `GET /api/auth-user` → `{"error":"no such table: auth-user","status":500}`
**Impact**: All auth collections and any collection with custom `dbName` are inaccessible in migration mode.
**Fix**: Added `registerCollections()` method to `DatabaseAdapter` interface and both adapters. `syncDatabaseSchema()` now always calls `registerCollections()` to populate table name mappings, regardless of sync mode. **FIXED in this branch.**

## Minor Issues

### 8. Vite SSR warnings for plugin dynamic imports

**Severity**: Minor
**Affected**: All plugins with admin routes (SEO, Analytics, OTel, Email)
**Description**: Plugins use variable-based dynamic imports (e.g., `const mod = './dashboard'; import(mod)`) to prevent esbuild from following server imports. This triggers Vite SSR warnings: "The above dynamic import cannot be analyzed by Vite."
**Impact**: Console noise only. Plugins work correctly despite warnings.
**Fix**: Add `/* @vite-ignore */` comments to the import() calls in the built plugin bundles.

### 9. OTel snapshot restore fails with access denied

**Severity**: ~~Minor~~ Fixed
**Affected**: `@momentumcms/plugins-otel`, `@momentumcms/server-core`
**Description**: On startup, the OTel plugin tries to read from `otel-snapshots` collection using `api.setContext({ overrideAccess: true })`, but `checkAccess()` in `CollectionOperationsImpl` was not checking the `overrideAccess` flag.
**Repro**: Start server with OTel → `Failed to restore snapshot: Access denied for read`
**Fix**: Added `if (this.context.overrideAccess) return;` early return to `CollectionOperationsImpl.checkAccess()`. Note: `server-express` bundles its own copy of `server-core`, so both packages must be rebuilt. **FIXED in this branch.**

### 11. Plugin config API mismatches vs docs/examples

**Severity**: Minor
**Affected**: `@momentumcms/plugins-analytics`, `@momentumcms/plugins-otel`
**Description**: The scaffolded config examples use property names that don't match the published TypeScript types:

- Analytics: `trackApiRequests` → should be `trackApi`
- OTel: `metrics: true` → should be `metrics: { enabled: true }`
- OTel: `dashboard: true` → not a valid top-level property, use `metrics: { adminDashboard: true }`
  **Impact**: TS compilation fails when users follow examples.
  **Fix**: Update CLI scaffolding templates or update the type interfaces to accept shorthand.

### 12. First user gets `role: 'user'` — no admin bootstrap

**Severity**: ~~Minor~~ Fixed
**Affected**: `@momentumcms/auth`
**Description**: The first user created via sign-up gets role `user`. All admin endpoints return 403 until the user is manually promoted to admin via direct DB update.
**Impact**: New users must run `sqlite3 data/stroll-test.db "UPDATE user SET role='admin' WHERE ..."` before using the admin UI.
**Fix**: Added Better Auth `databaseHooks.user.create.before` hook that counts existing users and sets `role: 'admin'` for the first user. Works for both SQLite and PostgreSQL. **FIXED in this branch.**

## What Works Well

- `npx create-momentum-app` scaffolding is clean and fast
- `npm run generate` correctly produces browser-safe admin config with all plugin routes
- Migration CLI (generate, run, rollback, status) works correctly (fixed in 0.5.6)
- Migration rollback + re-apply cycle works cleanly
- Migration mode (`syncSchema: false`) now works correctly with all collections including auth
- Analytics plugin tracks all API requests with rich context (OTel spans, method/status breakdowns)
- SEO plugin injects fields, generates sitemap.xml and robots.txt
- OTel plugin provides real-time metrics (uptime, request counts, memory, collection operations)
- OTel snapshot persistence works correctly (restore + flush cycle)
- Email plugin initializes and creates email-templates collection
- Redirects plugin creates redirects collection, CRUD works
- Form Builder plugin creates forms + form-submissions collections, CRUD works
- Plugin admin routes are correctly grouped in sidebar (SEO, Analytics, System, Tools)
- All plugin icons are correctly declared (heroChartBarSquare, heroSignal, etc.)
- Collection CRUD works for all 10 collections (posts, redirects, forms, form-submissions, email-templates, tracking-rules, auth-user, auth-session, auth-api-keys, otel-snapshots)
- Auth sign-up/sign-in works correctly
- First user automatically gets admin role
- Cookie-based auth works correctly with Better Auth session tokens
- Server starts with 7 plugins simultaneously without errors

## Plugins Not Tested

- **Queue** — Requires adapter (no built-in memory adapter shipped)
- **Cron** — Requires queue plugin instance
- **PostgreSQL** — Pending test
