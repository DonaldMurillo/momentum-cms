---
name: migrations
description: Run migrations, generate schemas, and manage code generation for Momentum CMS. Use when working with database migrations, Drizzle schema generation, type generation, or Angular schematics.
argument-hint: <generate|run|status|rollback|codegen>
---

# Migrations & Code Generation

Reference for database migrations and type/config generation in the Momentum CMS monorepo.

## Arguments

- `$ARGUMENTS` - Operation: `generate`, `run`, `status`, `rollback`, or `codegen`

## Field Builder Reference

Collections use typed field builders from `@momentumcms/core`. **Always use these builders — never define raw field objects.**

```typescript
import {
	text,
	textarea,
	richText,
	number,
	date,
	checkbox,
	select,
	radio,
	email,
	password,
	upload,
	relationship,
	array,
	group,
	blocks,
	json,
	point,
	slug,
	tabs,
	collapsible,
	row,
} from '@momentumcms/core';
```

### Common Field Builders

| Builder                    | DB Type        | Notes                                               |
| -------------------------- | -------------- | --------------------------------------------------- |
| `text(name, opts?)`        | `VARCHAR`      | String field. `{ required: true }` for non-nullable |
| `textarea(name, opts?)`    | `TEXT`         | Long text                                           |
| `richText(name, opts?)`    | `JSONB`        | Structured rich text content                        |
| `number(name, opts?)`      | `NUMERIC`      | Use `{ min, max }` for validation                   |
| `date(name, opts?)`        | `TIMESTAMPTZ`  | Date/time field                                     |
| `checkbox(name, opts?)`    | `BOOLEAN`      | Boolean field — **NOT** `boolean()`                 |
| `select(name, opts)`       | `VARCHAR`      | Requires `{ options: [...] }`                       |
| `radio(name, opts)`        | `VARCHAR`      | Requires `{ options: [...] }`                       |
| `email(name, opts?)`       | `VARCHAR`      | Email with validation                               |
| `upload(name, opts?)`      | `VARCHAR`      | File upload reference                               |
| `relationship(name, opts)` | `VARCHAR` (FK) | `{ collection: () => Target }`                      |
| `slug(name, opts)`         | `VARCHAR`      | Auto-generated from source field                    |
| `json(name, opts?)`        | `JSONB`        | Raw JSON storage                                    |
| `point(name, opts?)`       | `POINT`        | Geographic coordinates                              |

### Layout Fields (no DB column)

| Builder                   | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `array(name, opts)`       | Repeatable field groups (stored in JSONB)    |
| `group(name, opts)`       | Grouped fields under a namespace             |
| `blocks(name, opts)`      | Polymorphic content blocks (stored in JSONB) |
| `tabs(name, opts)`        | Tab-based field organization                 |
| `collapsible(name, opts)` | Collapsible section                          |
| `row(name, opts)`         | Horizontal layout for fields                 |

### Common Mistakes

- **`boolean()` does not exist** — use `checkbox()` for boolean fields
- **`string()` does not exist** — use `text()` for string fields
- Always import field builders from `@momentumcms/core`, not from sub-paths
- `relationship()` requires `collection: () => Target` (lazy reference to avoid circular imports)
- `select()` and `radio()` require an `options` array — not optional

## Collection Definition Pattern

```typescript
import {
	defineCollection,
	text,
	richText,
	number,
	relationship,
	allowAll,
} from '@momentumcms/core';
import { Products } from './products.collection';

export const Reviews = defineCollection({
	slug: 'reviews', // Must match filename: reviews.collection.ts
	labels: { singular: 'Review', plural: 'Reviews' },
	fields: [
		text('title', { required: true, label: 'Title' }),
		richText('body', { label: 'Body' }),
		number('rating', { required: true, label: 'Rating', min: 1, max: 5 }),
		relationship('product', { collection: () => Products, label: 'Product' }),
	],
	access: {
		read: allowAll(),
		create: allowAll(),
		update: allowAll(),
		delete: allowAll(),
		admin: allowAll(),
	},
});
```

**Key conventions:**

- File naming: `<slug>.collection.ts` in `libs/example-config/src/collections/`
- Export the collection constant from `libs/example-config/src/collections/index.ts`
- Slug must match the filename (e.g., `slug: 'reviews'` → `reviews.collection.ts`)
- Always include `access` configuration

## Momentum Migration CLI (`@momentumcms/migrations`)

```bash
# In the monorepo (via Nx targets on example apps):
nx run example-angular:migrate:generate   # Diff schema, create migration file
nx run example-angular:migrate:run        # Apply pending migrations
nx run example-angular:migrate:status     # Show applied vs pending
nx run example-angular:migrate:rollback   # Rollback latest batch
```

**Migration files are generated in the `migrations/` directory at the project root**, not inside `apps/`.

## Code Generation (Unified Generator)

The generator reads `momentum.config.ts` (server-side, Node) and outputs:

1. **TypeScript types** — interfaces for all collections, blocks, where clauses → `apps/example-angular/src/generated/momentum.types.ts`
2. **Browser-safe admin config** — inlined collections with server-only props stripped → `apps/example-angular/src/generated/momentum.config.ts`

```bash
nx run example-angular:generate          # One-shot generation
nx run example-angular:generate:watch    # Watch mode
```

## Migration Config Setup

If the `migrate:generate` target is not configured, add a migrations block to `momentum.config.ts`:

```typescript
const config = defineMomentumConfig({
	db: { adapter: dbAdapter },
	migrations: {
		directory: './migrations',
	},
	// ... rest of config
});
```

## Workflow

**Always follow this exact order:**

1. Make collection changes in `libs/example-config/src/collections/`
2. Export from barrel file `libs/example-config/src/collections/index.ts`
3. Run `nx run example-angular:generate` to regenerate types + admin config
4. Verify generated types at `apps/example-angular/src/generated/momentum.types.ts`
5. Run `nx run example-angular:migrate:generate` to create a migration file
6. Review the generated migration SQL in `migrations/`
7. Run `nx run example-angular:migrate:run` to apply

**Do NOT skip steps 2-3.** The type generator reads the live config — if the barrel doesn't export the new collection, it won't appear in generated types.

## Angular Schematics

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

<!-- v1 changes:
- Added complete field builder reference table with all 21 builders from @momentumcms/core
- Added "Common Mistakes" section (boolean() doesn't exist, use checkbox())
- Added full collection definition example with conventions
- Added migration config setup instructions
- Clarified migration files go to project root migrations/ dir
- Emphasized workflow ordering with "Do NOT skip" warning
- Added generated file output paths
-->
