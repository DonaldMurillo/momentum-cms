# Momentum CMS

An Angular-based headless CMS. Define collections in TypeScript, auto-generate an Admin UI, REST API, and database schema.

![Momentum CMS Overview](docs/visuals/dashboard/hero-flow.gif)

> **ALPHA SOFTWARE — DO NOT USE IN PRODUCTION.** This project is in early alpha. APIs will change, things will break, and there are missing features. It is a prototype and a learning platform. Use it for experimentation and prototyping only.

## Why Momentum?

I really enjoy using [Payload CMS](https://payloadcms.com). It's one of the best tools out there for rapid prototyping and content-heavy applications. The admin UI is great, the flexibility you get from defining collections in code is unmatched, and having everything — admin, API, auth, database — all living together inside one ecosystem (Next.js) is incredibly productive. I've grown to really like the patterns: collection-based config, field types, hooks, access control.

But I'm an Angular developer, and the Angular community doesn't have anything like it. There's no equivalent where you define your data model in TypeScript and get a full admin dashboard, REST API, authentication, and database schema generated automatically — all within the Angular ecosystem.

That's what Momentum is. It takes the patterns and developer experience I love from Payload CMS and brings them to Angular. The goal is to have a platform for quickly building Angular full-stack applications with an admin dashboard and prebuilt functionality out of the box, using [Better Auth](https://better-auth.com) for authentication and [Drizzle ORM](https://orm.drizzle.team) for the database layer. A lot of the design is directly inspired by how Payload does things — collections, fields, hooks, access control — adapted to work natively with Angular SSR (via Express or Analog/Nitro).

## Status: Alpha

**This project is not production-ready.** It is in active, early-stage development. Expect breaking changes, incomplete features, and rough edges.

A few things to know:

- **Built with AI.** This project is being developed almost entirely with AI tooling — primarily Claude Code. If that's not your thing, fair warning. I use a good chunk of my monthly AI budget on this, so development moves fast but in AI-assisted increments.
- **It's a prototype.** The main purpose right now is to have a solid platform for rapidly prototyping Angular full-stack apps. It works, but it's not battle-tested.
- **APIs will change.** Collection config, plugin interfaces, server adapters — all of it is subject to change as the project matures. Don't build anything critical on top of this yet.

## Quick Start

```bash
npx create-momentum-app my-app
cd my-app
npm run dev
```

The CLI will prompt you for:

- **Framework** - Angular (Express SSR) or Analog (Nitro)
- **Database** - PostgreSQL or SQLite

Then open `http://localhost:4200/admin` to access the admin dashboard.

## Documentation

Full documentation is available in the [docs/](docs/README.md) directory, covering collections, fields, access control, hooks, database adapters, authentication, plugins, and more.

## Features

- **Collection-first** - Define your data model in TypeScript; the admin UI, API routes, and database schema are generated automatically
- **Angular 21** - Server-side rendered with Express or Analog/Nitro
- **Admin Dashboard** - Auto-generated CRUD interface with rich text editing, relationships, file uploads, and dark mode
- **Drizzle ORM** - Type-safe database access with PostgreSQL and SQLite adapters
- **Authentication** - Built-in auth via Better Auth with email/password, sessions, and role-based access control
- **File Storage** - Local filesystem and S3-compatible storage adapters
- **Plugin System** - Event bus architecture with analytics and OpenTelemetry plugins
- **Soft Deletes** - Built-in trash/restore with configurable retention

## Define a Collection

```typescript
import { defineCollection, text, richText, relationship } from '@momentumcms/core';

export const Posts = defineCollection({
	slug: 'posts',
	fields: [
		text('title', { required: true }),
		richText('content'),
		relationship('author', { collection: () => Users }),
	],
	access: {
		read: () => true,
		create: ({ req }) => !!req.user,
	},
});
```

## Packages

| Package                          | npm                        | Description                                          |
| -------------------------------- | -------------------------- | ---------------------------------------------------- |
| `@momentumcms/core`              | `libs/core`                | Collection config, fields, hooks, and access control |
| `@momentumcms/db-drizzle`        | `libs/db-drizzle`          | Drizzle ORM database adapter (PostgreSQL + SQLite)   |
| `@momentumcms/auth`              | `libs/auth`                | Better Auth integration                              |
| `@momentumcms/server-core`       | `libs/server-core`         | Framework-agnostic server handlers                   |
| `@momentumcms/server-express`    | `libs/server-express`      | Express adapter for Angular SSR                      |
| `@momentumcms/server-analog`     | `libs/server-analog`       | Nitro/h3 adapter for Analog.js                       |
| `@momentumcms/admin`             | `libs/admin`               | Angular admin dashboard UI                           |
| `@momentumcms/ui`                | `libs/ui`                  | Base UI component library                            |
| `@momentumcms/storage`           | `libs/storage`             | File storage adapters (local, S3)                    |
| `@momentumcms/migrations`        | `libs/migrations`          | Database migration system (generate, run, rollback)  |
| `@momentumcms/logger`            | `libs/logger`              | Structured logging                                   |
| `@momentumcms/plugins-core`      | `libs/plugins/core`        | Plugin system core (event bus)                       |
| `@momentumcms/plugins-analytics` | `libs/plugins/analytics`   | Analytics and tracking plugin                        |
| `@momentumcms/plugins-seo`       | `libs/plugins/seo`         | SEO plugin (meta tags, sitemap, robots.txt)          |
| `@momentumcms/plugins-otel`      | `libs/plugins/otel`        | OpenTelemetry observability plugin                   |
| `create-momentum-app`            | `apps/create-momentum-app` | CLI scaffolding tool                                 |

## Architecture

```
┌─────────────────────────────────────────┐
│              Admin Dashboard            │
│          (@momentumcms/admin)          │
├─────────────────────────────────────────┤
│          Server Adapters                │
│   server-express  │  server-analog      │
├───────────────────┴─────────────────────┤
│           server-core                   │
│      (REST API, file handling)          │
├─────────────────────────────────────────┤
│    core     │   auth    │   storage     │
│  (fields,   │ (Better   │ (local, S3)   │
│   hooks,    │  Auth)    │               │
│   access)   │           │               │
├─────────────┴───────────┴───────────────┤
│             db-drizzle                  │
│      (PostgreSQL / SQLite)              │
└─────────────────────────────────────────┘
```

## Manual Integration

If you prefer to add Momentum CMS to an existing Angular project:

```bash
npm install @momentumcms/core @momentumcms/db-drizzle @momentumcms/auth \
  @momentumcms/server-core @momentumcms/admin @momentumcms/storage
```

For Angular + Express:

```bash
npm install @momentumcms/server-express
```

For Analog + Nitro:

```bash
npm install @momentumcms/server-analog
```

See the generated `momentum.config.ts` from `create-momentum-app` for a configuration example.

## Development

This is an Nx monorepo. Prerequisites: Node.js >= 18, npm.

```bash
# Install dependencies
npm install

# Dev server (example Angular app)
npx nx serve example-angular

# Run all tests
npx nx run-many -t test

# Build all packages
npx nx run-many -t build

# Lint
npx nx run-many -t lint

# Dependency graph
npx nx graph
```

### Testing the CLI

```bash
npm run test:create-app
```

This starts a local Verdaccio registry, publishes all packages, runs `create-momentum-app` for each flavor, and verifies the generated projects compile.

## Roadmap

These are planned features and improvements, in no particular priority order.

### UI & Components

- **Headless UI component library** — Fully customizable, unstyled components built on Angular CDK + Angular Aria, usable anywhere (not just the admin)
- **Swappable admin components** — Replace built-in admin components with your own custom implementations
- **Customizable admin layouts** — Angular slots and dynamic rendering for extending admin pages without forking
- **UX polish pass** — Improve interactions, transitions, and overall usability across the admin dashboard

### CMS Features

- **Redirects** — Manage URL redirects from the admin with pattern matching and status codes
- **Forms** — Form builder plugin for creating and managing front-end forms with submissions
- **Queueing** — Background job queue for async tasks (email sending, image processing, webhooks)
- **Image processing without Sharp** — Lightweight image optimization and resizing that doesn't depend on native binaries

### Auth & Integrations

- **Better Auth plugin adapters** — Pre-built adapters for Better Auth plugins (OAuth providers, magic links, passkeys, etc.) with easy opt-in configuration
- **Resend adapter** — Email delivery via Resend for transactional emails and auth flows
- **S3 storage adapter** — Production-ready S3-compatible object storage (AWS, Cloudflare R2, MinIO)

### Deployment & Infrastructure

- **Docker deployment guide** — Fully tested Docker setup for deploying to a standard VPS with PostgreSQL, reverse proxy, and persistent storage
- **Momentum website** — Build the official Momentum CMS website using Momentum itself

## Contributing

The best way to contribute is to **open a GitHub issue**. Be as specific as possible — include screenshots, error messages, reproduction steps, and what you expected to happen. The more context you provide, the better.

Here's why that matters: issues are often picked up directly with AI tooling (Claude Code, Codex) straight from GitHub. I'll grab an issue, feed it into the AI, and push changes based on the recommendations or bug reports. So the more detailed and specific your issue is, the more likely it gets resolved quickly and correctly. Vague issues like "it doesn't work" are hard for anyone to act on — but a screenshot with steps to reproduce is gold.

Pull requests are also welcome. Fork the repo, create a feature branch, make sure `npx nx affected -t test` and `npx nx affected -t lint` pass, and submit a PR.

## Acknowledgments

Inspired by [Payload CMS](https://payloadcms.com). Built with [Angular](https://angular.dev), [Drizzle ORM](https://orm.drizzle.team), [Better Auth](https://better-auth.com), and [Nx](https://nx.dev).

## License

[MIT](LICENSE)
