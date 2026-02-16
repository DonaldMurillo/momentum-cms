# Authentication Overview

Momentum CMS uses [Better Auth](https://better-auth.com) for authentication via the `@momentum-cms/auth` package.

## Setup

```typescript
import { momentumAuth } from '@momentum-cms/auth';

export default {
  auth: momentumAuth({
    // options
  }),
  collections: [...],
};
```

## Architecture

- **Better Auth** handles session management, password hashing, and auth flows
- A managed `user` collection is automatically created for auth tables
- Auth middleware runs in the server pipeline before access control checks
- Sessions are cookie-based by default

## Auth Endpoints

| Method | Path                      | Description         |
| ------ | ------------------------- | ------------------- |
| POST   | `/api/auth/sign-up/email` | Register new user   |
| POST   | `/api/auth/sign-in/email` | Login               |
| POST   | `/api/auth/sign-out`      | Logout              |
| GET    | `/api/auth/session`       | Get current session |

## User Context

Authenticated requests include `req.user` in access functions and hooks:

```typescript
access: {
  create: ({ req }) => {
    const user = req.user; // { id, email, role, ... }
    return !!user;
  },
}
```

## Related

- [Configuration](configuration.md) — Auth config options
- [Roles & Permissions](roles-and-permissions.md) — Role-based access
- [API Keys](api-keys.md) — Programmatic access
