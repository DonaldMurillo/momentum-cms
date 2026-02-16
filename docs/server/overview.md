# Server Overview

Momentum CMS uses a layered server architecture with framework-agnostic handlers and framework-specific adapters.

## Architecture

```
┌─────────────────────────┐
│   Framework Adapters    │
│  Express  │  Analog/h3  │
├───────────┴─────────────┤
│      server-core        │
│  (handlers, middleware)  │
├─────────────────────────┤
│  core │ auth │ storage  │
├─────────────────────────┤
│       db-drizzle        │
└─────────────────────────┘
```

## Packages

| Package                        | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `@momentum-cms/server-core`    | Framework-agnostic handlers, validation, middleware |
| `@momentum-cms/server-express` | Express adapter for Angular SSR                     |
| `@momentum-cms/server-analog`  | Nitro/h3 adapter for Analog.js                      |

## Request Lifecycle

1. **Auth middleware** — Extracts session/API key, attaches `req.user`
2. **Route matching** — Maps request to handler
3. **Access check** — Evaluates collection access functions
4. **Validation** — Validates field constraints and custom validators
5. **Before hooks** — Runs `beforeValidate`, `beforeChange`
6. **Database operation** — CRUD via the database adapter
7. **After hooks** — Runs `afterChange`, `afterRead`
8. **Webhooks** — Fires any configured webhooks
9. **Response** — Returns JSON result

## Initialization

```typescript
import { initializeMomentum } from '@momentum-cms/server-core';

const momentum = await initializeMomentum({
  db: adapter,
  collections: [...],
  auth: momentumAuth({ ... }),
  plugins: [...],
  seeding: { ... },
});
```

## Related

- [REST API](rest-api.md) — All endpoints
- [Express Adapter](express-adapter.md) — Angular SSR
- [Analog Adapter](analog-adapter.md) — Nitro/h3
- [GraphQL](graphql.md) — GraphQL schema
- [OpenAPI](openapi.md) — Swagger docs
