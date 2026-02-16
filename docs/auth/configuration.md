# Auth Configuration

Configure authentication options for your Momentum CMS application.

## Basic Config

```typescript
import { momentumAuth } from '@momentumcms/auth';

export default {
	auth: momentumAuth({
		// All options are optional
	}),
};
```

## Database Configuration

Auth needs database access for session/account tables:

```typescript
// PostgreSQL
auth: momentumAuth({
  db: { type: 'postgres', pool },
}),

// SQLite
auth: momentumAuth({
  db: { type: 'sqlite', database: './data/momentum.db' },
}),
```

## Auth Collection Options

The auth system creates a managed `user` collection. You can configure auth behavior:

```typescript
auth: true,  // On a collection to make it an auth collection

// Or with options:
auth: {
  tokenExpiration: 7200,        // Token TTL in seconds
  verify: false,                // Require email verification
  maxLoginAttempts: 5,          // Lockout after N failures
  lockTime: 900000,             // Lockout duration (ms)
  cookies: {
    secure: true,               // HTTPS only
    sameSite: 'lax',           // CSRF protection
    domain: '.example.com',    // Cookie domain
  },
}
```

## Sub-Plugins

Extend auth with Better Auth plugins for additional features like API keys, two-factor auth, etc.

## Related

- [Overview](overview.md) — Architecture
- [Roles & Permissions](roles-and-permissions.md) — Access control
