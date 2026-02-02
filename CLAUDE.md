# Momentum CMS

Angular-based headless CMS inspired by Payload CMS. Define collections in TypeScript, auto-generate Admin UI, REST API, and database schema.

## Tech Stack
- Angular 21 (SSR) + Analog.js 2.0 (optional)
- Nx 22+ monorepo with publishable npm packages
- Drizzle ORM for database
- Better Auth for authentication
- Tailwind CSS + @angular/aria + CDK

## Nx Commands
```bash
nx serve cms-admin          # Dev server
nx build cms-admin          # Production build
nx test <project>           # Run tests
nx lint <project>           # Lint project
nx affected -t test         # Test affected
nx graph                    # Dependency graph
nx build <lib>              # Build library
```

## Code Style
- **Standalone components only** (no NgModules for components)
- **Signals for state**: `signal()`, `computed()`, `effect()`
- **Signal inputs/outputs**: `input()`, `input.required()`, `output()`
- **inject() function**, not constructor injection
- **OnPush change detection** for all components
- **Control flow**: `@if`, `@for`, `@switch` (not *ngIf/*ngFor)
- **kebab-case** filenames, **PascalCase** classes
- **Barrel exports** via index.ts

## Libraries (@momentum-cms/*)
| Package | Path | Purpose |
|---------|------|---------|
| core | libs/core | Collection config, fields, hooks, access |
| server-core | libs/server-core | Framework-agnostic handlers |
| server-express | libs/server-express | Express adapter (Angular SSR) |
| server-analog | libs/server-analog | Nitro/h3 adapter (Analog.js) |
| admin | libs/admin | Angular admin UI components |
| db-drizzle | libs/db-drizzle | Drizzle adapter, schema generator |
| auth | libs/auth | Better Auth integration |

## Collection Pattern
```typescript
import { defineCollection, text, richText, relationship } from '@momentum-cms/core';

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

## Drizzle Migrations
```bash
nx run db-drizzle:generate-schema  # Generate schema from collections
npx drizzle-kit generate           # Create SQL migrations
npx drizzle-kit migrate            # Apply migrations
npx drizzle-kit push               # Direct push (dev only)
```

## Important Constraints
- NEVER import from apps into libs
- Use lazy collection refs: `collection: () => Users` (not string refs)
- Always use `trackBy` equivalent with `@for` track expression
- Prefer `signal()` over BehaviorSubject for state
- Use `inject()` not constructor injection
