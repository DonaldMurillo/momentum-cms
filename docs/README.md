# Momentum CMS Documentation

> **Alpha Software** — APIs will change, features are incomplete. Use for experimentation only.

![Momentum CMS Overview](visuals/dashboard/hero-flow.gif)

## Getting Started

- [Quick Start](getting-started/quick-start.md) — Scaffold a new project in minutes
- [Project Structure](getting-started/project-structure.md) — What each file does in a generated project
- [Your First Collection](getting-started/your-first-collection.md) — Define, migrate, and use a collection

## Collections

- [Overview](collections/overview.md) — `defineCollection`, slugs, labels, indexes
- [Fields](collections/fields.md) — All field types with examples
- [Access Control](collections/access-control.md) — Restrict read/create/update/delete per collection
- [Hooks](collections/hooks.md) — Lifecycle hooks (before/after validate, change, read, delete)
- [Soft Deletes](collections/soft-deletes.md) — Trash, restore, retention, force delete
- [Versions & Drafts](collections/versions-and-drafts.md) — Drafts, autosave, scheduled publishing
- [Globals](collections/globals.md) — Singleton collections with `defineGlobal`
- [Webhooks](collections/webhooks.md) — Event subscriptions with HMAC signatures
- [Custom Endpoints](collections/custom-endpoints.md) — Add your own API routes

## Database

- [Overview](database/overview.md) — Adapter pattern and schema generation
- [PostgreSQL](database/postgres.md) — Connection pooling, JSONB, configuration
- [SQLite](database/sqlite.md) — WAL mode, in-memory, configuration
- [Migrations](database/migrations.md) — Generate and apply migrations with Drizzle Kit
- [Field Mappings](database/field-mappings.md) — How field types map to SQL columns

## Authentication

- [Overview](auth/overview.md) — Architecture and Better Auth integration
- [Configuration](auth/configuration.md) — Auth config options and sub-plugins
- [Roles & Permissions](auth/roles-and-permissions.md) — Role-based access control
- [API Keys](auth/api-keys.md) — Programmatic access with scoped API keys

## Server

- [Overview](server/overview.md) — Server architecture and adapters
- [REST API](server/rest-api.md) — All endpoints: CRUD, versions, batch, globals, media
- [GraphQL](server/graphql.md) — Auto-generated schema and queries
- [Express Adapter](server/express-adapter.md) — Angular SSR integration
- [Analog Adapter](server/analog-adapter.md) — Nitro/h3 integration
- [OpenAPI](server/openapi.md) — Swagger UI and spec generation

## Admin Dashboard

- [Overview](admin/overview.md) — Dashboard pages and routing
- [API Service](admin/api-service.md) — `injectMomentumAPI` for data operations
- [Theme](admin/theme.md) — Dark mode, CSS variables, `McmsThemeService`
- [Tailwind Setup](admin/tailwind-setup.md) — Preset, content paths, theme variables

## Storage

- [Overview](storage/overview.md) — Storage adapter interface
- [Local Filesystem](storage/local.md) — Configuration and usage
- [S3 / MinIO](storage/s3.md) — S3-compatible storage with presigned URLs

## Plugins

- [Overview](plugins/overview.md) — Plugin interface, event bus, PluginRunner
- [Analytics](plugins/analytics.md) — Tracking rules, content performance, block analytics
- [OpenTelemetry](plugins/opentelemetry.md) — Distributed tracing
- [Writing a Plugin](plugins/writing-a-plugin.md) — Build your own plugin

## Seeding

- [Overview](seeding/overview.md) — Seed config, defaults, and helpers

## Logger

- [Overview](logger/overview.md) — Log levels, namespaces, formatters
