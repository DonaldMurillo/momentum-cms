# Auth Library (`@momentumcms/auth`)

Better Auth integration for Momentum CMS. Plugin-based architecture that manages auth collections, session resolution, and sub-plugin composition.

## Architecture Overview

```
momentumAuth(config)          ← Plugin factory (auth-plugin.ts)
  ├── BASE_AUTH_COLLECTIONS   ← 5 auth collections (auth-collections.ts)
  ├── createMomentumAuth()    ← Better Auth instance (auth.ts)
  └── sub-plugins[]           ← Composable extensions (plugins/)
        ├── authTwoFactor()
        ├── authAdmin()
        └── authOrganization()
```

### Key Files

| File                          | Purpose                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `auth-plugin.ts`              | `momentumAuth()` factory — creates the `MomentumPlugin`                |
| `auth.ts`                     | `createMomentumAuth()` — wraps `betterAuth()` with Momentum defaults   |
| `auth-collections.ts`         | Base auth collections (user, session, account, verification, api-keys) |
| `plugins/sub-plugin.types.ts` | `MomentumAuthSubPlugin` interface                                      |
| `plugins/two-factor.ts`       | Example sub-plugin pattern                                             |

### Plugin Lifecycle

1. `momentumAuth(config)` is called at config time — collects sub-plugin collections/fields
2. `plugin.collections` is read by admin routes for static route data (browser-safe)
3. `plugin.onInit(context)` runs during server init — injects collections, creates Better Auth instance
4. `initializeMomentum()` in server-express detects the auth plugin, auto-creates middleware

## Collection Slugs and DB Tables

Auth collections use `auth-` prefixed slugs to avoid conflicts with user-defined collections.

| Slug                | DB Table       | Sidebar                     | Access                                              |
| ------------------- | -------------- | --------------------------- | --------------------------------------------------- |
| `auth-user`         | `user`         | Yes (group: Authentication) | Admin only (read/write)                             |
| `auth-session`      | `session`      | No (hidden)                 | Admin read, no write                                |
| `auth-account`      | `account`      | No (hidden)                 | No read (contains OAuth tokens/passwords), no write |
| `auth-verification` | `verification` | No (hidden)                 | No access                                           |
| `auth-api-keys`     | `_api_keys`    | Yes (group: Authentication) | Any authenticated user (scoped by `defaultWhere`)   |

Internal collections (`auth-session`, `auth-account`, `auth-verification`) are `managed: true` — the API blocks write operations (POST/PATCH/DELETE return 403). Better Auth owns the data. `auth-user` and `auth-api-keys` are NOT managed: `auth-user` allows admin CRUD, `auth-api-keys` blocks writes via access control and routes deletion through the dedicated `/api/auth/api-keys/:id` endpoint with ownership checks.

## Critical: Session and Role Handling

### No Cookie Cache

The Better Auth session config intentionally has **no `cookieCache`**. This was removed because:

- Cookie cache stores session data (including `role`) in a signed cookie
- When a user's role changes (e.g., setup flow creates admin), the cached cookie retains the stale role
- All subsequent requests read stale `role: 'user'` from the cookie instead of `role: 'admin'` from the DB
- This causes auth collection access checks (`req.user?.role === 'admin'`) to fail with 403

**Never re-enable `cookieCache`** unless you also solve stale role propagation (e.g., invalidate sessions on role change).

### Role Update Flow

The setup flow (`POST /setup/create-admin`) does:

1. `auth.api.signUpEmail()` — creates user with `role: 'user'` (Better Auth default)
2. `updateUserRolePostgres()` — SQL update to set `role: 'admin'`

The role column is an `additionalFields` entry in Better Auth's user config, not a native field. Better Auth reads it from the DB on every `getSession()` call (since there's no cookie cache), so role changes take effect immediately.

### Seeding and `onConflict: 'skip'`

Seeds use `authUser()` helper which calls `signUpEmail()` + `adapter.update()` for role. But seeds are tracked by `seedId` — if the seed was already processed, `onConflict: 'skip'` returns early **without updating the role**. This means:

- Changing a seed's `role` from `'user'` to `'admin'` has no effect on existing databases
- You must either: (a) delete the `_seed_tracking` row for that seed, (b) use a new seedId, or (c) update the role via direct SQL

## Sub-Plugin Pattern

Sub-plugins extend auth without modifying the core. Each sub-plugin provides:

```typescript
export interface MomentumAuthSubPlugin {
	name: string; // For logging
	betterAuthPlugin: unknown; // The Better Auth plugin instance
	collections?: CollectionConfig[]; // Managed collections to inject
	userFields?: Field[]; // Fields to add to auth-user
	sessionFields?: Field[]; // Fields to add to auth-session
}
```

### Creating a Sub-Plugin

Follow the `two-factor.ts` pattern:

1. Create `plugins/my-plugin.ts`
2. Define any managed collections with `defineCollection({ managed: true, ... })`
3. Export a factory function returning `MomentumAuthSubPlugin`
4. Use `admin: { hidden: true }` for internal collections users shouldn't see
5. Set restrictive `access` rules — most auth data shouldn't be directly accessible

### Sub-Plugin Collection Rules

- Use `auth-` prefix for slugs (e.g., `auth-two-factor`)
- Set `dbName` to match Better Auth's expected table name
- Always set `managed: true` — Better Auth owns the data
- Match field definitions exactly to Better Auth's schema

## Browser-Safe Imports

The auth-collections are importable in browser code via:

```typescript
import { BASE_AUTH_COLLECTIONS } from '@momentumcms/auth/collections';
```

This path alias (`tsconfig.base.json`) points to `auth-collections.ts`, which only imports from `@momentumcms/core` (no Node.js dependencies). This is used by `momentumAdminRoutes()` for static route generation.

**Never add Node.js imports** (pg, better-auth, etc.) to `auth-collections.ts`.

## Common Pitfalls

1. **403 on auth collections after role change**: Role is stale. Check `req.user.role` — if it's `'user'` when it should be `'admin'`, the DB role wasn't updated or the session is stale. Clear cookies and re-login, or check the DB directly.

2. **Seed doesn't update role**: Seeds with `onConflict: 'skip'` won't re-process. See "Seeding and onConflict" above.

3. **New sub-plugin fields not appearing**: Better Auth needs the field in `additionalFields`. The plugin factory merges `userFields` into the auth config automatically — make sure the sub-plugin returns them.

4. **Collection slug vs DB table name**: Auth collections use `auth-user` as the slug (for API routes, admin UI) but `user` as the DB table (`dbName`). The Drizzle adapter's `resolveTableName()` handles the mapping. Don't use raw table names in API calls.

5. **E2E tests and role timing**: E2E fixtures use `signUpEmail()` + direct DB role update + fresh `signIn()`. The separate sign-in ensures the new session reads the correct role. Don't rely on the session from `signUpEmail()` after a role change.
