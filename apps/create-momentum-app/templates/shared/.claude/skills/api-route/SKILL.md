---
name: api-route
description: Generate API route handlers for Express, NestJS, or Analog.js
argument-hint: <route-name>
---

# Generate API Route

Create API route handlers for your Momentum CMS project.

## Arguments

- `$ARGUMENTS` - Route name (e.g., "health", "custom-endpoint")

## For Express / NestJS (Angular SSR)

Both the Express and NestJS server adapters expose an Express instance. Custom routes use the same Express Router pattern.

Create handler in `src/api/<route-name>.ts`:

```typescript
import { Router, Request, Response } from 'express';
import type { CollectionConfig } from '@momentumcms/core';

export function create<PascalName>Routes(collections: CollectionConfig[]): Router {
  const router = Router();

  router.get('/<route-name>', async (req: Request, res: Response) => {
    try {
      // Implementation
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
```

Register in `src/server.ts`:

```typescript
import { create<PascalName>Routes } from './api/<route-name>';

// Express: register on the Express app directly
app.use('/api', create<PascalName>Routes(collections));

// NestJS: register via afterApiMiddleware in createMomentumNestServer()
afterApiMiddleware: (app) => {
  app.use('/api', create<PascalName>Routes(collections));
  // ...existing static files and Angular SSR handlers
},
```

## For Analog.js

Create file-based route in `src/server/routes/api/<route-name>.get.ts`:

```typescript
import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
	const query = getQuery(event);

	try {
		// Implementation
		return { success: true };
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: 'Internal server error',
		});
	}
});
```

## HTTP Method Suffixes (Analog.js)

- `index.get.ts` - GET request
- `index.post.ts` - POST request
- `[id].get.ts` - GET with dynamic param
- `[id].patch.ts` - PATCH with dynamic param
- `[id].delete.ts` - DELETE with dynamic param
- `[...].ts` - Catch-all route

## h3 Utilities

```typescript
import {
	defineEventHandler,
	getQuery,
	readBody,
	getRouterParam,
	createError,
	setResponseStatus,
} from 'h3';
```
