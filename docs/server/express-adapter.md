# Express Adapter

Integrate Momentum CMS with Angular SSR via Express.

## Package

```bash
npm install @momentum-cms/server-express
```

## Setup

In your `server.ts`:

```typescript
import express from 'express';
import { createMomentumServer } from '@momentum-cms/server-express';
import momentumConfig from './momentum.config';

const app = express();

// Initialize Momentum and register API routes
await createMomentumServer(app, momentumConfig);

// Angular SSR handles remaining routes
// ...

app.listen(4200);
```

## How It Works

1. `createMomentumServer()` initializes the database, auth, plugins, and seeding
2. API routes are registered on the Express app at `/api/*`
3. Auth middleware is attached for session handling
4. Angular SSR serves the admin dashboard and frontend routes

## Middleware

The adapter registers:

- JSON body parser
- Auth session middleware
- Collection CRUD routes
- Global routes
- Media upload routes
- Custom endpoint routes

## Integration with Angular SSR

The Express server runs alongside Angular's SSR engine. API routes are handled by Momentum, while Angular handles page rendering:

```
GET /api/posts     → Momentum (REST API)
GET /admin         → Angular SSR (admin dashboard)
GET /about         → Angular SSR (frontend page)
```

## Related

- [Overview](overview.md) — Server architecture
- [Analog Adapter](analog-adapter.md) — Alternative adapter
