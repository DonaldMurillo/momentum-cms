# Migrations

Manage database schema changes safely with the Momentum migration system or Drizzle Kit.

## Momentum Migrations (Recommended)

The `@momentumcms/migrations` package provides a full migration system with snapshot-based diffing, danger detection, and a clone-test-apply safety pipeline.

### Workflow

#### 1. Make Changes

Edit your collection definitions (add fields, create collections, etc.).

#### 2. Generate Types

```bash
npm run generate
```

Regenerates TypeScript types and admin config from your collections.

#### 3. Generate a Migration

```bash
npm run migrate:generate
```

Diffs the current collection schema against the last snapshot and writes a timestamped migration file. Optionally name it:

```bash
npm run migrate:generate -- --name add-posts-table
```

Preview without writing files:

```bash
npm run migrate:generate -- --dry-run
```

#### 4. Apply Migrations

```bash
npm run migrate:run
```

Applies all pending migrations. For PostgreSQL, this uses a clone-test-apply safety pipeline by default:

1. Clones the database
2. Tests all pending migrations on the clone
3. If successful, applies to the real database

Skip safety check (not recommended for production):

```bash
npm run migrate:run -- --skip-clone-test
```

Test-only mode (verifies on clone, does not apply):

```bash
npm run migrate:run -- --test-only
```

### Check Status

```bash
npm run migrate:status
```

Shows all migration files and whether they are applied or pending.

### Rollback

```bash
npm run migrate:rollback
```

Rolls back the latest batch of applied migrations.

### Configuration

Configure migration behavior in `momentum.config.ts`:

```typescript
const config = defineMomentumConfig({
	migrations: {
		directory: './migrations', // Migration files directory
		mode: 'auto', // 'push' (dev), 'migrate' (prod), or 'auto'
		cloneTest: true, // Clone-test-apply safety (PostgreSQL only)
		dangerDetection: true, // Warn about destructive operations
		autoApply: true, // Auto-apply in push mode on server start
	},
	// ...
});
```

### Push vs Migrate Modes

| Mode      | Use Case    | What It Does                                        |
| --------- | ----------- | --------------------------------------------------- |
| `push`    | Development | Directly syncs the schema (no migration files)      |
| `migrate` | Production  | Requires migration files, tracks applied migrations |
| `auto`    | Default     | Uses `push` in dev, `migrate` in production         |

### Angular Schematics

For Angular CLI projects, you can also use schematics:

```bash
ng generate @momentumcms/migrations:generate    # Generate migration
ng generate @momentumcms/migrations:run          # Run migrations
ng generate @momentumcms/migrations:status       # Check status
ng generate @momentumcms/migrations:rollback     # Rollback
```

## Drizzle Kit (Simple Mode)

For simpler setups, you can use Drizzle Kit directly:

```bash
npx drizzle-kit generate   # Creates SQL migration files
npx drizzle-kit push       # Direct push (dev only)
npx drizzle-kit migrate    # Apply migrations (production)
```

### Drizzle Kit Config

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

- Always run `npm run generate` after changing collections
- Review generated migration files before applying to production
- Keep migration files in version control
- Use `push` mode only in development for rapid iteration
- The clone-test-apply pipeline catches migration errors before they hit production

## Related

- [PostgreSQL](postgres.md) — PostgreSQL setup
- [SQLite](sqlite.md) — SQLite setup
- [Field Mappings](field-mappings.md) — How fields become columns
