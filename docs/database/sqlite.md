# SQLite

SQLite adapter configuration for Momentum CMS.

## Setup

```typescript
import { sqliteAdapter } from '@momentumcms/db-drizzle';

export default {
	db: sqliteAdapter({
		database: process.env['DATABASE_PATH'] || './data/momentum.db',
	}),
};
```

## Environment Variable

```env
DATABASE_PATH=./data/momentum.db
```

## Features

- **WAL mode** enabled by default for better concurrent reads
- **Zero configuration** — no database server needed
- **In-memory option** for testing: `database: ':memory:'`
- **File-based** — easy to back up and deploy

## Dependencies

The `better-sqlite3` package is required:

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

## When to Use

SQLite works well for:

- Development and prototyping
- Small to medium deployments
- Single-server applications
- CI/CD testing

For production with high concurrency, consider [PostgreSQL](postgres.md).

## Related

- [PostgreSQL](postgres.md) — For larger deployments
- [Migrations](migrations.md) — Managing schema changes
