# CLI Stroll Test Issues

Tested `npx create-momentum-app@0.5.5` with Angular + Express + SQLite on 2026-03-10.

## Blocker Issues

### 1. Migration schematics reference wrong CLI path

**Severity**: Blocker
**Affected**: `@momentumcms/migrations` (all 4 schematics)
**Description**: All migration schematics reference `node_modules/@momentumcms/migrations/cli/*.cjs` but the published package has these files at `node_modules/@momentumcms/migrations/src/cli/*.cjs`.
**Repro**: `npm run migrate:generate` → `ERR_MODULE_NOT_FOUND`
**Files**: `libs/migrations/schematics/{generate,run,rollback,status}/index.ts`
**Fix**: Change `cli/` to `src/cli/` in all schematic paths. **FIXED in this branch.**

### 2. Database adapters missing `queryRaw` and `executeRaw` methods

**Severity**: Blocker
**Affected**: `@momentumcms/db-drizzle` (both SQLite and PostgreSQL adapters)
**Description**: The migration runner requires `queryRaw()` and `executeRaw()` on the DatabaseAdapter, but neither adapter implements them.
**Repro**: `npm run migrate:run` → `DatabaseAdapter must implement queryRaw and executeRaw for migration tracking`
**Files**: `libs/db-drizzle/src/lib/db-drizzle.ts`, `libs/db-drizzle/src/lib/db-postgres.ts`
**Fix**: Added `queryRaw`, `executeRaw`, and `introspect` to SQLite adapter; `queryRaw` and `executeRaw` to PostgreSQL adapter. **FIXED in this branch.**

### 3. `@momentumcms/form-builder` not published at 0.5.5

**Severity**: Blocker
**Affected**: `@momentumcms/plugins-form-builder`
**Description**: `@momentumcms/plugins-form-builder` depends on `@momentumcms/form-builder@0.5.5` but only version 0.5.3 exists on npm. Installation fails with `ETARGET`.
**Repro**: `npm install @momentumcms/plugins-form-builder` → `No matching version found for @momentumcms/form-builder@0.5.5`
**Fix**: Publish `@momentumcms/form-builder@0.5.5` or update the dependency range to `>=0.5.3`.

## Major Issues

### 4. Migration generator ignores plugin-injected collections

**Severity**: Major
**Affected**: `@momentumcms/migrations` CLI
**Description**: `collectionsToSchema()` in the migration generator only reads `config.collections` (explicitly declared collections). Collections added by plugins via `modifyCollections()` or pushed during `onInit` are not included. Plugin tables (tracking-rules, email-templates, redirects, otel-snapshots, etc.) cannot get migrations generated.
**Repro**: Add analytics plugin → `npm run migrate:generate` → "Schema up to date" (even though tracking-rules collection was added)
**Files**: `libs/migrations/src/cli/generate.ts:43`
**Impact**: Users must use `syncSchema: true` for plugin tables, defeating the migration system's purpose.

### 5. Auth tables not managed by migration system

**Severity**: Major
**Affected**: `@momentumcms/auth` + migrations
**Description**: When `syncSchema: false` and `migrations.mode: 'migrate'`, Better Auth tables (user, session, account, verification) are never created. Auth signup/signin returns 500. Better Auth manages its own schema but relies on the server's auto-sync to trigger table creation.
**Repro**: Scaffold with `syncSchema: false` → `npm run migrate:run` → start server → POST `/api/auth/sign-up/email` → 500
**Impact**: Users cannot use strict migration mode without manually creating auth tables.

### 6. Missing admin-routes `.d.ts` files for 4 plugins

**Severity**: Major
**Affected**: `@momentumcms/plugins-email`, `@momentumcms/plugins-cron`, `@momentumcms/plugins-queue`, `@momentumcms/plugins-form-builder`
**Description**: These plugins declare `./admin-routes` sub-path exports with types pointing to `.d.ts` files that don't exist in the published package. The generated admin config imports these, causing TS compilation failures.
**Repro**: Add email plugin → `npm run generate` → `npm run dev` → `TS7016: Could not find a declaration file for module '@momentumcms/plugins-email/admin-routes'`
**Files**: Each plugin needs a handwritten `*-admin-routes.d.ts` alongside its `.ts` source.
**Fix**: Created `.d.ts` files for email, cron, queue, and form-builder. **FIXED in this branch.**

### 7. Image plugin crashes Vite dev server

**Severity**: Major
**Affected**: `@momentumcms/plugins-image`
**Description**: The image plugin uses `@napi-rs/image` which includes native `.node` binary files. Vite's esbuild dependency optimizer cannot handle `.node` files, crashing the dev server.
**Repro**: Add image plugin to config → `npm run dev` → `No loader is configured for ".node" files`
**Fix**: Mark `@napi-rs/image` as external in Vite config, or add the package to `optimizeDeps.exclude`.

## Minor Issues

### 8. Vite SSR warnings for plugin dynamic imports

**Severity**: Minor
**Affected**: All plugins with admin routes (SEO, Analytics, OTel, Email)
**Description**: Plugins use variable-based dynamic imports (e.g., `const mod = './dashboard'; import(mod)`) to prevent esbuild from following server imports. This triggers Vite SSR warnings: "The above dynamic import cannot be analyzed by Vite."
**Impact**: Console noise only. Plugins work correctly despite warnings.
**Fix**: Add `/* @vite-ignore */` comments to the import() calls in the built plugin bundles.

### 9. OTel snapshot restore fails with access denied

**Severity**: Minor
**Affected**: `@momentumcms/plugins-otel`
**Description**: On startup, the OTel plugin tries to read from `otel-snapshots` collection but gets "Access denied for read on collection otel-snapshots". The plugin handles this gracefully (logs warning), but shouldn't fail.
**Repro**: Start server with OTel → `Failed to restore snapshot: Access denied for read`
**Fix**: Ensure `otel-snapshots` collection has admin read access or use internal API bypass.

### 10. First user gets `role: 'user'` — no admin bootstrap

**Severity**: Minor
**Affected**: `@momentumcms/auth`
**Description**: The first user created via sign-up gets role `user`. All admin endpoints return 403 until the user is manually promoted to admin via direct DB update.
**Impact**: New users must run `sqlite3 data/stroll-test.db "UPDATE user SET role='admin' WHERE ..."` before using the admin UI.
**Fix**: First user should automatically get `admin` role, or the setup wizard should handle this.

## What Works Well

- `npx create-momentum-app` scaffolding is clean and fast
- `npm run generate` correctly produces browser-safe admin config with all plugin routes
- Migration CLI (generate, run, rollback, status) works correctly once path/adapter issues are fixed
- Analytics plugin tracks all API requests automatically with rich context
- SEO plugin injects fields, generates sitemap.xml and robots.txt
- OTel plugin provides real-time metrics (uptime, request counts, memory usage)
- Plugin admin routes are correctly grouped in sidebar (SEO, Analytics, System, Tools)
- All plugin icons are correctly declared (heroChartBarSquare, heroSignal, etc.)
- Collection CRUD works for posts, redirects, tracking-rules, email-templates
- Auth sign-up/sign-in works (once tables exist)

## Plugins Not Tested

- **Queue** — Requires adapter (no built-in memory adapter shipped)
- **Cron** — Requires queue plugin instance
- **Form Builder** — Blocked by npm publish issue (#3)
- **Image** — Blocked by Vite `.node` loader issue (#7)
- **PostgreSQL** — Skipped pending fix of blocker issues first
