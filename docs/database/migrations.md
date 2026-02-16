# Migrations

Manage database schema changes with Drizzle Kit.

## Workflow

### 1. Make Changes

Edit your collection definitions (add fields, create collections, etc.).

### 2. Generate Migrations

```bash
npx drizzle-kit generate
```

Creates SQL migration files in your migrations directory.

### 3. Apply Migrations

**Production:**

```bash
npx drizzle-kit migrate
```

**Development (direct push):**

```bash
npx drizzle-kit push
```

## Push vs Migrate

| Command                            | Use Case    | What It Does                                             |
| ---------------------------------- | ----------- | -------------------------------------------------------- |
| `drizzle-kit push`                 | Development | Directly alters the database schema (no migration files) |
| `drizzle-kit generate` + `migrate` | Production  | Creates migration SQL files, then applies them           |

## Drizzle Kit Config

Create `drizzle.config.ts` in your project root:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/drizzle-schema.ts',
	out: './drizzle',
	dialect: 'postgresql', // or 'sqlite'
	dbCredentials: {
		url: process.env['DATABASE_URL']!,
	},
});
```

## Tips

- Always run `generate` before deploying to production
- Review generated SQL files before applying
- Keep migration files in version control
- Use `push` only in development for rapid iteration

## Related

- [PostgreSQL](postgres.md) — PostgreSQL setup
- [SQLite](sqlite.md) — SQLite setup
- [Field Mappings](field-mappings.md) — How fields become columns
