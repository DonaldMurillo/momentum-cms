# PostgreSQL

PostgreSQL adapter configuration for Momentum CMS.

## Setup

```typescript
import { postgresAdapter } from '@momentum-cms/db-drizzle';

export default {
	db: postgresAdapter({
		connectionString: process.env['DATABASE_URL']!,
	}),
};
```

## Environment Variable

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

## Features

- **Connection pooling** via the `pg` package
- **JSONB** for array fields, blocks fields, and JSON fields (efficient querying)
- **Full-text search** support
- **Transactions** with proper isolation levels

## Dependencies

The `pg` package is required:

```bash
npm install pg
```

## Related

- [SQLite](sqlite.md) — Alternative for simpler deployments
- [Migrations](migrations.md) — Managing schema changes
