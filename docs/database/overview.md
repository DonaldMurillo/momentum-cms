# Database Overview

Momentum CMS uses an adapter pattern for database access. The `@momentumcms/db-drizzle` package provides a Drizzle ORM adapter supporting PostgreSQL and SQLite.

## How It Works

1. You define collections with fields in TypeScript
2. Momentum auto-generates a Drizzle schema from your collections
3. Drizzle Kit creates SQL migrations from schema changes
4. The database adapter handles all CRUD operations

## Configuration

```typescript
// momentum.config.ts
import { postgresAdapter } from '@momentumcms/db-drizzle';

export default {
  db: postgresAdapter({
    connectionString: process.env['DATABASE_URL']!,
  }),
  collections: [...],
};
```

## Adapters

| Adapter           | Package                   | Database   |
| ----------------- | ------------------------- | ---------- |
| `postgresAdapter` | `@momentumcms/db-drizzle` | PostgreSQL |
| `sqliteAdapter`   | `@momentumcms/db-drizzle` | SQLite     |

## Schema Generation

The adapter automatically generates Drizzle table definitions from your collection configs, mapping each field type to the appropriate SQL column type.

## Related

- [PostgreSQL](postgres.md) — PostgreSQL configuration
- [SQLite](sqlite.md) — SQLite configuration
- [Migrations](migrations.md) — Migration workflow
- [Field Mappings](field-mappings.md) — How fields map to SQL
