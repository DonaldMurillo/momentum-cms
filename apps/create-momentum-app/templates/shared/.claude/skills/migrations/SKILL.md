---
name: migrations
description: Run migrations, generate schemas, and manage code generation for Momentum CMS.
argument-hint: <generate|run|status|rollback|codegen>
---

# Migrations & Code Generation

Reference for database migrations and type/config generation.

## Arguments

- `$ARGUMENTS` - Operation: `generate`, `run`, `status`, `rollback`, or `codegen`

## Migration CLI

```bash
npm run migrate:generate   # Diff schema, create migration file
npm run migrate:run        # Apply pending migrations
npm run migrate:status     # Show applied vs pending
npm run migrate:rollback   # Rollback latest batch
```

## Drizzle Kit

```bash
npx drizzle-kit generate   # Create SQL migrations from schema diff
npx drizzle-kit migrate    # Apply migrations
npx drizzle-kit push       # Direct push (dev only, skips migration files)
```

## Code Generation

The generator reads `momentum.config.ts` (server-side, Node) and outputs:

1. **TypeScript types** — interfaces for all collections, blocks, where clauses
2. **Browser-safe admin config** — inlined collections with server-only props stripped

```bash
npm run generate           # One-shot generation (types + admin config)
```

Output files (do not edit manually):

- `src/generated/momentum.types.ts` — TypeScript interfaces
- `src/generated/momentum.config.ts` — Browser-safe admin config

## Workflow

1. Make collection changes in `src/collections/`
2. Run `npm run generate` to regenerate types + admin config
3. Run `npm run migrate:generate` to create a migration file
4. Review the generated migration SQL
5. Run `npm run migrate:run` to apply
6. Restart the dev server
