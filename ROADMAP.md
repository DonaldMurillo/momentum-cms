# Roadmap

This document tracks the feature roadmap for Momentum CMS — what we've built, what's next, and what we've explicitly decided not to build.

Last updated: May 2026

## What We Already Have

Momentum CMS ships with a comprehensive feature set today:

### Content Modeling

- **20 field types**: text, textarea, richText, number, date, checkbox, select, radio, email, password, upload, relationship, array, group, blocks, json, point, slug, tabs, collapsible, row
- Polymorphic relationships with configurable `onDelete` behavior (set-null, restrict, cascade)
- Layout fields (tabs, collapsible, row) for organizing the admin form
- Field-level access control, hooks, validation, and conditional display
- Display formatting via `Intl.NumberFormat` and `Intl.DateTimeFormat`

### Code Generation

- Modular code generator decomposed into focused modules (types, client, admin config, serialization)
- TypeScript interface generation from collection configs (`--types`)
- Browser-safe Angular admin config generation (`--config`)
- Framework-agnostic fetch-based client SDK generation (`--client`) for React, Vue, Svelte, vanilla JS
- Security hardening: unsafe key quoting, path traversal prevention, import path sanitization, identifier validation

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
- Live preview side panel with real-time in-memory rendering (no iframes) via signals-based `LivePreviewService`
- Dark mode via theme service

### Versioning & Drafts

- Full document version history with restore
- Version diff UI with deep diff engine, field-level change highlighting, and side-by-side comparison
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

### P2 — Low Priority

#### Review Workflows

Multi-stage content approval beyond draft/published. Custom workflow stages per collection (e.g., Draft -> In Review -> Approved -> Published) with stage transition hooks and role-based stage access.

#### Multi-tenancy

Dedicated tenant system beyond the current `defaultWhere` scoping. Tenant collection, tenant-scoped data isolation, per-tenant admin branding, and tenant-aware file storage.

---

## Tech Debt

| Area                   | Issue                                                                                                                                                                                                                                                                                                                                                                        | Impact                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile tap targets** | The shared `Button` component's `size="sm"` variant lands at ~30-32px on phones. Passes WCAG 2.5.8 AA (24px) but misses the 44px AAA recommendation and Apple HIG. Most affected surface today is `mcms-publish-controls` (Publish / Schedule / Unpublish / Cancel-schedule on the article edit page) and the Confirmation dialog footer buttons.                            | Tap-misses on mobile, especially when buttons are crowded after wrap. The fix: introduce a responsive size token that bumps `sm` to ≥40px on `(pointer: coarse)` viewports, then audit the rest of the admin for the same regression.                                                                             |
| **Server adapters**    | NestJS DI controllers now reach full route parity — Media, Upload, Batch, Search, ImportExport, Preview, GraphQL, and CustomEndpoints joined the existing Access/Globals/Status/Version/Publishing controllers. Express/Analog still inline a few niche routes that the consolidation hasn't touched (preview rendering, custom-endpoint dispatch with multi-segment paths). | Default `createMomentumNestServer` already had full route parity via Express middleware; the new optional controllers exist so users wiring their own NestJS modules can pick up DI guards / interceptors / OpenAPI metadata route-by-route. Remaining inline Express/Analog logic is small and not user-visible. |

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

- NestJS controller parity — eight new optional DI controllers (`MediaController`, `UploadController`, `BatchController`, `SearchController`, `ImportExportController`, `PreviewController`, `GraphQLController`, `CustomEndpointsController`) bring the NestJS adapter to route parity with Express. All wrap shared `server-core` handlers; default `createMomentumNestServer` continues to mount routes via Express middleware so behavior is unchanged unless consumers opt into DI controllers. 17 new spec assertions covering the dispatch + error envelopes.
- Versioning + publishing UI hardening — Schedule Publish dialog with future-date validation, Scheduled-for badge with Cancel-schedule confirmation flow, version-history auto-refresh on save-draft / publish / schedule actions via the new `actionPerformed` output and `reloadKey` input, plus 14 new Playwright specs covering save-draft, unpublish, restore, schedule, cancel-schedule, and adversarial flows (publish race, two-tab edit, invalid dates, restore current, restore unknown id).
- NestJS Version + Publishing controllers — DI-based controllers for `/:collection/:id/versions*` and `/:collection/:id/{publish,unpublish,draft,schedule-publish,cancel-scheduled-publish}` wired to the shared `server-core` handlers, mirroring the Access/Globals/Status pattern. Shared `extractUser` helper extracted to remove duplication across controllers.
- AI/MCP integration — MCP server plugin exposing CMS data to AI tools via Model Context Protocol, 12 tools (CRUD, search, schema introspection, globals), 4 resources (momentum:// URI scheme), 2 prompts (content creation, translation), security-first defaults (write tools opt-in, API key required, auth collections auto-excluded, limit/depth clamping), end-to-end verified with Claude Code CLI E2E tests
- API response caching plugin — in-memory LRU and Redis adapters, ETag/304 support, per-collection cache config, automatic invalidation on writes, CDN headers (Cache-Control, Surrogate-Control, Vary), admin dashboard with stats and manual purge
- Media library enhancements — folder and tag organization, asset metadata search, bulk upload UI
- Import/Export — CSV and JSON import UI in the admin panel, collection data export, data transfer tool
- Version diff UI — deep diff engine with field-level change highlighting, side-by-side comparison, inline diff toggle, and version navigation with security access control
- Live preview side panel — real-time in-memory Angular rendering with `LivePreviewService`, signals-based instant updates, per-collection preview components, and form builder plugin support
- Client SDK generation (`--client` flag) — framework-agnostic, fetch-based TypeScript API client with typed CRUD, globals, auth modes, and error handling
- Generator decomposition into focused modules (types, client, admin config, serialization)
- Security hardening: unsafe object key quoting, path traversal prevention, import path sanitization, `softDelete.field` identifier validation
- Headless UI component library (32 accessible, unstyled Angular primitives)
- NestJS adapter (CRUD parity; remaining routes tracked under tech debt)
- Form builder plugin with conditional fields, validation, submissions, webhooks
- Email builder with visual editor, live preview, Handlebars, pluggable transport
- Queue and cron plugins for background processing
- Redirects plugin with server middleware
- Image processing with `@napi-rs/image` (no Sharp), focal point cropping
- Versioning and drafts with scheduled publishing
- Swappable admin pages and layout slots with per-collection overrides
