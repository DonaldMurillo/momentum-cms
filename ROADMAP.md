# Roadmap

This document tracks the feature roadmap for Momentum CMS — what we've built, what's next, and what we've explicitly decided not to build.

Last updated: March 2026

## What We Already Have

Momentum CMS ships with a comprehensive feature set today:

### Content Modeling

- **20 field types**: text, textarea, richText, number, date, checkbox, select, radio, email, password, upload, relationship, array, group, blocks, json, point, slug, tabs, collapsible, row
- Polymorphic relationships with configurable `onDelete` behavior (set-null, restrict, cascade)
- Layout fields (tabs, collapsible, row) for organizing the admin form
- Field-level access control, hooks, validation, and conditional display
- Display formatting via `Intl.NumberFormat` and `Intl.DateTimeFormat`

### API

- Auto-generated REST API for all collections
- Auto-generated GraphQL schema with queries and mutations
- Full-text search via PostgreSQL `tsvector`/`tsquery`
- Filtering with `where` clauses (equals, not_equals, gt, gte, lt, lte, like, contains, in, not_in, exists, and/or)
- Sorting, pagination, depth population
- Custom endpoints per collection
- OpenAPI/Swagger documentation generation
- Database transaction support

### Authentication & Access Control

- Better Auth integration with email/password, sessions, and email verification
- Role-based access at collection, field, and operation levels
- API key authentication
- OAuth provider support (Google, GitHub, etc.)
- Account lockout, password reset flows
- Version-specific access control (readVersions, publishVersions, restoreVersions, readDrafts)
- Soft delete access control (restore, forceDelete)

### Admin Dashboard

- Auto-generated CRUD interface for all collections
- Bulk operations (row selection, bulk delete/publish/unpublish)
- Rich text editor (TipTap with formatting toolbar)
- Visual block editor with drag-drop reordering and command palette inserter
- Searchable list views with configurable columns, sorting, pagination
- Custom component overrides per collection (list, edit, view pages)
- Layout slots (beforeList, afterList, beforeEdit, afterEdit, editSidebar, etc.)
- Plugin-injected admin routes with sidebar navigation
- Media library with upload, search, and edit
- Responsive design (mobile drawer sidebar, adaptive grids)
- Dark mode via theme service

### Versioning & Drafts

- Full document version history with restore
- Draft/published workflow
- Autosave with configurable interval
- Scheduled publishing (`scheduledPublishAt`)
- Version-specific access control
- Version hooks (create, restore, publish, unpublish, delete)

### Globals

- Singleton document support with fields, access control, hooks, and versioning

### Database

- PostgreSQL and SQLite adapters via Drizzle ORM
- Migration system with schema diffing, introspection, advisory locks
- Database cloning for safe migration testing
- Data migration helpers (backfill, transform, renameColumn, splitColumn, mergeColumns, dedup)

### Storage & Media

- Local filesystem and S3-compatible storage adapters
- Image processing with variant generation and format preference (jpeg/webp/avif)
- Focal point selection and crop calculation
- MIME type validation with magic byte detection
- Per-collection upload configuration

### Plugins

- **SEO** — Meta tags, Open Graph, Twitter cards, sitemap.xml, robots.txt, content analysis with scoring, admin dashboard
- **Form Builder** — Schema-driven forms with conditional fields, validation, submission storage, webhook forwarding
- **Email Builder** — Visual template editor with live preview, Handlebars templating, pluggable transport
- **Image Processing** — Automatic variant generation with focal point cropping
- **Redirects** — Collection-based URL redirect management with server middleware
- **Analytics** — Event tracking
- **OpenTelemetry** — Metrics and tracing
- **Queue** — Background job processing with priority, retry, backoff, stall detection
- **Cron** — Scheduled task execution

### Hooks & Webhooks

- Collection hooks: beforeValidate, beforeChange, afterChange, beforeRead, afterRead, beforeDelete, afterDelete, beforeRestore, afterRestore
- Field hooks: beforeValidate, beforeChange, afterChange, afterRead
- Webhooks per collection with HMAC-SHA256 signature verification, retries, and custom headers

### UI Components

- **32 headless primitives** (libs/headless): Accordion, AlertDialog, Checkbox, Chips, Collapsible, Combobox, Command, ContextMenu, Dialog, Drawer, Field, Grid, HoverCard, Input, Listbox, Menu, Popover, Progress, RadioGroup, Select, Separator, Skeleton, Spinner, Switch, Tabs, Textarea, Toast, Toggle, Toolbar, Tooltip, Tree
- **40+ styled components** (libs/ui): Built on headless primitives with Tailwind CSS
- **Theme editor**: Visual CSS variable editor with presets, light/dark mode, live preview

### Server Adapters

- Express (Angular SSR)
- NestJS (Angular SSR)
- Analog/Nitro

---

## Planned Features

### P0 — High Priority

#### Live Preview (In-Memory Angular Rendering)

Real-time content preview directly inside the admin panel. Since Momentum is fully Angular, we render the target page component in-memory — no iframes, no `postMessage`, no cross-origin complexity. Draft form state is injected via DI providers, and because everything is signals-based, previews update instantly as the user types.

Possible approaches: secondary router outlets, `ViewContainerRef` dynamic loading, or a dedicated preview outlet.

#### Version Diff UI

Version snapshots are already stored — we need a visual way to compare them. Side-by-side or inline diff viewer with field-level change highlighting and version navigation.

#### Standalone Frontend SDK (`@momentumcms/client`)

The typed API client (`MomentumClientAPI`) exists inside `@momentumcms/admin` but is Angular-specific. Extract it to a standalone `@momentumcms/client` package so React, Vue, Svelte, and vanilla JS consumers can use typed queries against the Momentum API.

### P1 — Medium Priority

#### Media Library Enhancements

Folder and tag organization, asset metadata search, and bulk upload UI. The current media library handles uploads and basic browsing but lacks organizational features.

#### Import/Export

CSV and JSON import UI in the admin panel, collection data export, and a data transfer tool for moving content between environments.

#### API Response Caching

Configurable cache layer (Redis or in-memory) with automatic invalidation on writes. Support for ETags and conditional requests. CDN integration for static assets.

#### AI/MCP Integration

MCP (Model Context Protocol) server that exposes CMS data to AI tools. Enables AI-assisted content creation, translation, and management through standard AI tool protocols.

### P2 — Low Priority

#### Review Workflows

Multi-stage content approval beyond draft/published. Custom workflow stages per collection (e.g., Draft -> In Review -> Approved -> Published) with stage transition hooks and role-based stage access.

#### Multi-tenancy

Dedicated tenant system beyond the current `defaultWhere` scoping. Tenant collection, tenant-scoped data isolation, per-tenant admin branding, and tenant-aware file storage.

---

## Not Planned

These features were evaluated and explicitly decided against:

| Feature                                 | Reason                                                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Localization / i18n**                 | Not a priority for current use cases                                                                           |
| **Real-time / WebSocket subscriptions** | Not needed — webhooks cover integration use cases                                                              |
| **No-code schema builder**              | By design. Momentum is code-first — you define collections in TypeScript. This is a feature, not a limitation. |
| **Nested documents plugin**             | Unclear value — tree structures can be modeled with self-referencing relationships                             |

---

## Recently Shipped

- Headless UI component library (32 accessible, unstyled Angular primitives)
- NestJS adapter with full API parity
- Form builder plugin with conditional fields, validation, submissions, webhooks
- Email builder with visual editor, live preview, Handlebars, pluggable transport
- Queue and cron plugins for background processing
- Redirects plugin with server middleware
- Image processing with `@napi-rs/image` (no Sharp), focal point cropping
- Versioning and drafts with scheduled publishing
- Swappable admin pages and layout slots with per-collection overrides
