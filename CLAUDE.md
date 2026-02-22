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
nx serve example-angular    # Dev server
nx build example-angular    # Production build
nx test <project>           # Run Vitest unit tests
nx lint <project>           # Lint project
nx affected -t test         # Test affected
nx affected -t build        # Build affected
nx graph                    # Dependency graph
nx run-many -t lint         # Lint all projects
```

## Testing (TDD)

- **Unit tests**: Vitest (`nx test <lib>`)
- **E2E tests**: Playwright (no mocks, real server)
- Write tests BEFORE implementation (Red-Green-Refactor)
- Test files: `*.spec.ts` in `__tests__/` or alongside source
- **ALL tests must pass** — there is no such thing as "pre-existing failures". Failing tests are bugs. Fix them.
- **NO skipped tests** — every test must run. If a test can't pass, fix or delete it.

## E2E Test Rules (Playwright)

Three patterns are **banned** in E2E tests:

1. **NO `.catch(() => false/null/{})` on Playwright calls** — silently swallows failures, making tests pass regardless of actual behavior. `request.delete()` returns a response (never throws on 404), so `.catch()` is unnecessary even in cleanup.

2. **NO `waitForTimeout(N)` or `page.waitForTimeout(N)`** — hardcoded waits are flaky. Use:
   - `await expect(locator).toBeVisible({ timeout: N })` for waiting on elements
   - `expect.poll(() => ..., { timeout: N })` for polling async conditions
   - Raw `setTimeout` only for negative proofs (verifying something does NOT happen), with a comment explaining why

3. **NO ambiguous OR-logic status assertions** like `.ok() || .status() === 201` — Use exact assertions:
   - `expect(response.status()).toBe(201)` for creates
   - `expect(response.ok()).toBe(true)` for reads/updates/deletes

## Code Style

- **Standalone components** (default in Angular 21 - don't add `standalone: true`)
- **Signals for state**: `signal()`, `computed()`, `effect()`
- **Signal inputs/outputs**: `input()`, `input.required()`, `output()`
- **inject() function**, not constructor injection
- **OnPush change detection** for all components
- **Control flow**: `@if`, `@for`, `@switch` (not *ngIf/*ngFor)
- **kebab-case** filenames, **PascalCase** classes
- **Barrel exports** via index.ts

## UI Component Patterns

### No Wrapping Divs

Angular components create a host element. Use `host` property for Tailwind styles:

```typescript
@Component({
  selector: 'mcms-button',
  host: { class: 'inline-flex items-center gap-2' }, // Styles on host
  template: `<ng-content />`, // Content projected directly
})
```

NOT:

```typescript
template: `<div class="inline-flex items-center gap-2"><ng-content /></div>`, // Unnecessary wrapper
```

### Class Configuration

Accept `class` input for Tailwind customization:

```typescript
@Component({
	selector: 'button[mcms-button]',
	host: { '[class]': 'hostClasses()' },
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class McmsButtonComponent {
	readonly variant = input<'primary' | 'secondary'>('primary');
	readonly class = input(''); // Custom class override

	readonly hostClasses = computed(
		() => `${baseClasses} ${variantClasses[this.variant()]} ${this.class()}`,
	);
}
```

### Theme Service

Use `McmsThemeService` for dark mode:

```typescript
import { McmsThemeService } from '@momentumcms/admin';

@Component({...})
export class MyComponent {
  private readonly theme = inject(McmsThemeService);

  toggleDarkMode(): void {
    this.theme.toggleTheme(); // Toggles between light/dark
  }

  // Reactive signals
  readonly isDark = this.theme.isDark; // computed signal
  readonly currentTheme = this.theme.theme; // 'light' | 'dark' | 'system'
}
```

### App Tailwind Setup

Apps using the admin library must:

1. **tailwind.config.js** - Use the admin preset and include library sources:

```javascript
const adminPreset = require('../../libs/admin/tailwind.preset');

module.exports = {
	presets: [adminPreset],
	content: [
		join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
		join(__dirname, '../../libs/admin/src/**/*.{ts,html}'), // Include admin lib
		...createGlobPatternsForDependencies(__dirname),
	],
};
```

2. **styles.css** - Include CSS variables inline (Angular's esbuild can't resolve library CSS imports):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
	:root {
		--mcms-background: 0 0% 100%;
		--mcms-foreground: 222 47% 11%;
		/* ... copy from libs/admin/src/styles/theme.css */
	}
	.dark {
		/* dark mode variables */
	}
}
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
- Server-tagged libs expose browser-safe sub-paths via `allow` patterns (see below)

### Auth Sub-path Imports

`@momentumcms/auth` is `env:server` but exposes browser-safe sub-paths:

| Import Path                     | Use Case                                                            |
| ------------------------------- | ------------------------------------------------------------------- |
| `@momentumcms/auth`             | Server-only: `momentumAuth()`, `createMomentumAuth()`               |
| `@momentumcms/auth/core`        | Browser-safe types: `MomentumUser`, `MomentumSession`, `AUTH_ROLES` |
| `@momentumcms/auth/collections` | Browser-safe collection definitions: `BASE_AUTH_COLLECTIONS`        |

## Collection Pattern

```typescript
import { defineCollection, text, richText, relationship } from '@momentumcms/core';

export const Posts = defineCollection({
	slug: 'posts',
	fields: [
		text('title', { required: true }),
		richText('content'),
		relationship('author', { collection: () => Users }),
	],
	access: {
		read: () => true,
		create: ({ req }) => !!req.user,
	},
});
```

## Migrations

### Momentum Migration CLI (`@momentumcms/migrations`)

```bash
# In the monorepo (via Nx targets on example apps):
nx run example-angular:migrate:generate   # Diff schema, create migration file
nx run example-angular:migrate:run        # Apply pending migrations
nx run example-angular:migrate:status     # Show applied vs pending
nx run example-angular:migrate:rollback   # Rollback latest batch
```

### Drizzle Kit (Simple/Legacy)

```bash
nx run db-drizzle:generate-schema  # Generate schema from collections
npx drizzle-kit generate           # Create SQL migrations
npx drizzle-kit migrate            # Apply migrations
npx drizzle-kit push               # Direct push (dev only)
```

## Code Generation

### Unified Generator (Types + Admin Config)

The generator reads `momentum.config.ts` (server-side, Node) and outputs:

1. **TypeScript types** — interfaces for all collections, blocks, where clauses
2. **Browser-safe admin config** — inlined collections with server-only props stripped

```bash
nx run example-angular:generate          # One-shot generation
nx run example-angular:generate:watch    # Watch mode
```

### Angular Schematics

Both `@momentumcms/core` and `@momentumcms/migrations` ship Angular schematics:

```bash
# Type/config generation (in scaffolded Angular projects)
ng generate @momentumcms/core:types

# Migrations (in scaffolded Angular projects)
ng generate @momentumcms/migrations:generate
ng generate @momentumcms/migrations:run
ng generate @momentumcms/migrations:status
ng generate @momentumcms/migrations:rollback
```

## Admin Config Generator

The admin config generator reads `momentum.config.ts` (server-side, Node) and outputs a browser-safe TypeScript file with proper imports. This eliminates manual wiring of collections, auth collections, and plugin routes in app routing.

Usage in app routes:

```typescript
import { momentumAdminRoutes } from '@momentumcms/admin';
import { adminConfig } from '../generated/momentum.config';

export const appRoutes: Route[] = [
	...momentumAdminRoutes(adminConfig),
	// app-specific routes...
];
```

Plugins declare browser-safe imports via `browserImports` on `MomentumPlugin`:

```typescript
browserImports: {
	collections: { path: '@momentumcms/auth/collections', exportName: 'BASE_AUTH_COLLECTIONS' },
	adminRoutes: { path: '@momentumcms/plugins/analytics/admin-routes', exportName: 'analyticsAdminRoutes' },
	modifyCollections: { path: '@momentumcms/plugins/analytics/block-fields', exportName: 'injectBlockAnalyticsFields' },
}
```

## Custom Field Renderers

Field renderers are lazily loaded via `FieldRendererRegistry`. Built-in renderers are registered with `provideMomentumFieldRenderers()`. Apps must include this provider:

```typescript
import { provideMomentumFieldRenderers } from '@momentumcms/admin';

export const appConfig: ApplicationConfig = {
	providers: [provideMomentumFieldRenderers()],
};
```

To add a custom field type:

```typescript
import { provideFieldRenderer } from '@momentumcms/admin';

export const appConfig: ApplicationConfig = {
	providers: [
		provideMomentumFieldRenderers(),
		provideFieldRenderer('color', () =>
			import('./renderers/color-field.component').then((m) => m.ColorFieldRenderer),
		),
	],
};
```

## Important Constraints

- NEVER import from apps into libs
- Use lazy collection refs: `collection: () => Users` (not string refs)
- Always use `trackBy` equivalent with `@for` track expression
- Prefer `signal()` over BehaviorSubject for state
- Use `inject()` not constructor injection

## Code Quality (Enforced by ESLint)

- **NO `standalone: true`** - default in Angular 21, redundant
- **NO `@Input()`** - use `input()` or `input.required()`
- **NO `@Output()`** - use `output()`
- **NO `@ViewChild()`** - use `viewChild()` or `viewChild.required()`
- **NO `as` assertions** - use type guards or fix types
- **NO explicit `any`** - use proper types
- **NO console.log** - only `console.warn` and `console.error`
- All functions must have explicit return types

## Prettier Config

- Semi: true
- Tabs: true (tabWidth: 2)
- Trailing commas: all
- Arrow parens: always
- Print width: 100

## Git Hooks (Husky + lint-staged)

Pre-commit runs:

1. lint-staged (eslint --fix + prettier)
2. nx affected -t build (includes type checking)
