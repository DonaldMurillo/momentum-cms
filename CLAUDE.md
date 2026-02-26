# Momentum CMS

Angular-based headless CMS inspired by Payload CMS. Define collections in TypeScript, auto-generate Admin UI, REST API, and database schema.

## Tech Stack

- Angular 21 (SSR) + Analog.js 2.0 (optional)
- Nx 22+ monorepo with publishable npm packages
- Drizzle ORM for database
- Better Auth for authentication
- Tailwind CSS + @angular/aria + CDK
- **Vitest** for unit tests (TDD approach)
- **Playwright** for E2E tests (strict mode, no mocks)

## Nx Commands

```bash
nx serve example-angular
nx build example-angular
nx test <project>
nx lint <project>
nx affected -t test
nx affected -t build
nx graph
nx run-many -t lint
```

## Libraries (@momentumcms/\*)

| Package        | Path                | Env       | Purpose                                  |
| -------------- | ------------------- | --------- | ---------------------------------------- |
| core           | libs/core           | universal | Collection config, fields, hooks, access |
| logger         | libs/logger         | universal | Shared logging utilities                 |
| ui             | libs/ui             | browser   | Shared UI components                     |
| admin          | libs/admin          | browser   | Angular admin UI components              |
| server-core    | libs/server-core    | server    | Framework-agnostic handlers              |
| server-express | libs/server-express | server    | Express adapter (Angular SSR)            |
| server-analog  | libs/server-analog  | server    | Nitro/h3 adapter (Analog.js)             |
| db-drizzle     | libs/db-drizzle     | server    | Drizzle adapter, schema generator        |
| auth           | libs/auth           | server    | Better Auth integration                  |
| storage        | libs/storage        | server    | File storage adapters                    |
| plugins/core   | libs/plugins/core   | server    | Plugin infrastructure (runner, events)   |
| plugins/\*     | libs/plugins/\*     | server    | Individual plugins (analytics, otel)     |

### Environment Boundary Rules (ESLint)

- `env:browser` can only import from `env:browser` or `env:universal`
- `env:server` can only import from `env:server` or `env:universal`
- `env:universal` can only import from `env:universal`
- Server-tagged libs expose browser-safe sub-paths via `allow` patterns

### Auth Sub-path Imports

`@momentumcms/auth` is `env:server` but exposes browser-safe sub-paths:

| Import Path                     | Use Case                                                            |
| ------------------------------- | ------------------------------------------------------------------- |
| `@momentumcms/auth`             | Server-only: `momentumAuth()`, `createMomentumAuth()`               |
| `@momentumcms/auth/core`        | Browser-safe types: `MomentumUser`, `MomentumSession`, `AUTH_ROLES` |
| `@momentumcms/auth/collections` | Browser-safe collection definitions: `BASE_AUTH_COLLECTIONS`        |

## Skills, Agents & Hooks

Domain-specific guidance lives in workflow elements, not here. Key ones:

- `/component` — Angular component generation with UI patterns, host styling, theme service
- `/collection` — Collection scaffolding with full field type catalog
- `/e2e-test` — Playwright tests (dashboard-first, no blind tests)
- `/migrations` — Migration CLI, Drizzle Kit, code generation, schematics
- `/admin-config` — Admin route wiring, plugin browser imports, field renderers
- `/momentum-api` — Angular API client usage (queries, CRUD, SSR hydration)
- `code-quality` agent — DRY/KISS/SRP + Angular anti-patterns (runs before completion)
- `test-reviewer` agent — Catches lying tests (runs after writing tests)
- `a11y-auditor` agent — WCAG 2.1 AA audit (runs on UI component changes)
- `stop-check` hook — Blocks completion if quality agents/tests weren't run
- `lint-fix` hook — Auto-runs ESLint fix on every Write/Edit
