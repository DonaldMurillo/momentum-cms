# NestJS Adapter

Integrate Momentum CMS with Angular SSR via NestJS.

## Package

```bash
npm install @momentumcms/server-nestjs @nestjs/common @nestjs/core rxjs
```

## Setup

In your `server.ts`:

```typescript
import express from 'express';
import { createMomentumNestServer } from '@momentumcms/server-nestjs';
import momentumConfig from './momentum.config';

const server = await createMomentumNestServer({ config: momentumConfig });

// Get underlying Express instance for static files + SSR
const expressApp = server.app.getHttpAdapter().getInstance();

// Static files
expressApp.use(express.static(browserDistFolder));

// Session resolver before SSR (populates req.user)
expressApp.use(server.sessionResolver);

// Angular SSR catch-all
expressApp.use((req, res, next) => {
	angularApp
		.handle(req, { providers: server.getSsrProviders(req.user) })
		.then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
		.catch(next);
});

await server.app.listen(4200);
```

## How It Works

1. `createMomentumNestServer()` initializes the database, auth, plugins, and seeding via `initializeMomentum()` from `@momentumcms/server-express`
2. A minimal NestJS app is created with `MomentumModule` for DI container access
3. All CMS API routes (CRUD, versions, publish, batch, search, GraphQL, file upload, etc.) are mounted as Express middleware on the underlying Express instance
4. Express middleware runs before NestJS route handlers, giving full endpoint coverage
5. Angular SSR serves the admin dashboard and frontend routes

## Options

| Option             | Type                                       | Default | Description                                   |
| ------------------ | ------------------------------------------ | ------- | --------------------------------------------- |
| `config`           | `MomentumConfig \| ResolvedMomentumConfig` | —       | Momentum CMS configuration (required)         |
| `prefix`           | `string`                                   | `'api'` | API route prefix                              |
| `health`           | `boolean`                                  | `true`  | Mount health endpoint at `/{prefix}/health`   |
| `publishScheduler` | `boolean \| { intervalMs: number }`        | `false` | Start publish scheduler for scheduled content |
| `webhooks`         | `boolean`                                  | `true`  | Register webhook hooks on collections         |
| `authPlugin`       | `MomentumAuthPlugin`                       | —       | Auth plugin (auto-detected from config)       |
| `providerFactory`  | `(api, context) => unknown[]`              | —       | SSR provider factory for Angular              |

## Return Value

`createMomentumNestServer()` returns a `MomentumNestServer` object:

| Property          | Type                   | Description                                   |
| ----------------- | ---------------------- | --------------------------------------------- |
| `app`             | `INestApplication`     | NestJS application instance                   |
| `init`            | `MomentumInitResult`   | Initialization result with ready promise      |
| `sessionResolver` | `RequestHandler`       | Session middleware for SSR (mount before SSR) |
| `getSsrProviders` | `(user?) => unknown[]` | Get SSR providers for Angular rendering       |
| `shutdown`        | `() => Promise<void>`  | Graceful shutdown                             |

## Using MomentumModule

The `MomentumModule` provides DI tokens for custom NestJS controllers:

```typescript
import { Controller, Get, Inject } from '@nestjs/common';
import { MomentumApiService, MOMENTUM_CONFIG } from '@momentumcms/server-nestjs';

@Controller('custom')
export class CustomController {
	constructor(private readonly api: MomentumApiService) {}

	@Get('stats')
	async getStats() {
		const api = this.api.getApi();
		// Use the Momentum API directly
	}
}
```

## Opt-In Controllers

`@momentumcms/server-nestjs` also exports DI-based controllers that mirror routes already served by the Express middleware. Use these when you want NestJS-native guards, interceptors, OpenAPI metadata, or per-route logging on top of the shared `server-core` handlers:

| Controller             | Routes                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccessController`     | `GET /access`                                                                                                                                                                                 |
| `GlobalsController`    | `GET /globals/:slug`, `PATCH /globals/:slug`                                                                                                                                                  |
| `StatusController`     | `GET /:collection/:id/status`                                                                                                                                                                 |
| `VersionController`    | `GET /:collection/:id/versions`, `GET /:collection/:id/versions/:versionId`, `POST /:collection/:id/versions/restore`, `POST /:collection/:id/versions/compare`                               |
| `PublishingController` | `POST /:collection/:id/publish`, `POST /:collection/:id/unpublish`, `POST /:collection/:id/draft`, `POST /:collection/:id/schedule-publish`, `POST /:collection/:id/cancel-scheduled-publish` |

Each controller is a thin dispatcher to the shared handlers in `@momentumcms/server-core`, so behavior, validation, and error envelopes match the Express adapter byte-for-byte.

```typescript
import { Module } from '@nestjs/common';
import {
	MomentumModule,
	VersionController,
	PublishingController,
} from '@momentumcms/server-nestjs';
import config from './momentum.config';

@Module({
	imports: [MomentumModule.forRoot(config)],
	controllers: [VersionController, PublishingController],
})
export class AppModule {}
```

Mount these only if you wire your own NestJS module — `createMomentumNestServer` already serves the same routes via Express middleware.

## Express vs NestJS Adapter

Both adapters provide identical CMS functionality — the same 128+ API endpoints, auth, webhooks, and plugins. The difference is the application framework:

- **Express adapter** — Lightweight, direct Express integration
- **NestJS adapter** — NestJS lifecycle, DI container, guards, interceptors for custom routes

The NestJS adapter delegates all CMS routes to the same Express middleware used by the Express adapter, so there is zero feature gap.

## Related

- [Overview](overview.md) — Server architecture
- [Express Adapter](express-adapter.md) — Alternative adapter
