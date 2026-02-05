# Momentum CMS Features

> Feature tracking document comparing Momentum CMS with Payload CMS capabilities.

## Legend

- ✅ Implemented
- 🚫 Won't Do
- ❌ Not Started

---

## Core Features

### Field Types

| Field        | Status | Notes                                           |
| ------------ | ------ | ----------------------------------------------- |
| text         | ✅     | With validation, placeholder                    |
| textarea     | ✅     | Multi-line text                                 |
| richText     | ✅     | TipTap editor with formatting toolbar           |
| email        | ✅     | With email validation                           |
| password     | ✅     | Hashed storage                                  |
| slug         | ✅     | Auto-generated from title                       |
| number       | ✅     | min/max/step support                            |
| checkbox     | ✅     | Boolean field                                   |
| date         | ✅     | Date picker                                     |
| select       | ✅     | Single/multi select                             |
| radio        | ✅     | Radio button group                              |
| relationship | ✅     | Lazy refs, hasMany, search picker               |
| array        | ✅     | Add/remove/reorder rows with sub-fields         |
| group        | ✅     | Nested field groups with admin renderer         |
| blocks       | ✅     | Block type selector with per-block fields       |
| json         | ✅     | Arbitrary JSON storage                          |
| point        | ✅     | Lat/lng geolocation                             |
| upload       | ✅     | File upload with storage adapters               |
| tabs         | ✅     | Layout field for form organization              |
| collapsible  | ✅     | Collapsible field group                         |
| row          | ✅     | Horizontal field layout                         |
| ui           | ❌     | Custom UI components in forms                   |

### Collection System

| Feature              | Status | Notes                                |
| -------------------- | ------ | ------------------------------------ |
| defineCollection()   | ✅     | Full collection config               |
| defineGlobal()       | ✅     | Singleton documents                  |
| Custom slugs         | ✅     | kebab-case enforced                  |
| Admin config         | ✅     | useAsTitle, columns, pagination      |
| Custom endpoints     | ✅     | Wired in Express with E2E tests      |
| TypeScript inference | ✅     | Full type safety                     |

### Access Control

| Feature               | Status | Notes                            |
| --------------------- | ------ | -------------------------------- |
| Collection-level CRUD | ✅     | read/create/update/delete        |
| Field-level access    | ✅     | Per-field permissions            |
| Role-based helpers    | ✅     | hasRole, hasAnyRole, hasAllRoles |
| isOwner check         | ✅     | Document ownership               |
| Combinators           | ✅     | and/or/not                       |
| Admin access          | ✅     | Panel access control             |

### Hooks

| Feature           | Status | Notes               |
| ----------------- | ------ | ------------------- |
| beforeValidate    | ✅     | Pre-validation hook |
| beforeChange      | ✅     | Pre-save hook       |
| afterChange       | ✅     | Post-save hook      |
| beforeRead        | ✅     | Pre-fetch hook      |
| afterRead         | ✅     | Post-fetch hook     |
| beforeDelete      | ✅     | Pre-delete hook     |
| afterDelete       | ✅     | Post-delete hook    |
| Field-level hooks | ✅     | Per-field hooks     |

### Database

| Feature                | Status | Notes                              |
| ---------------------- | ------ | ---------------------------------- |
| SQLite adapter         | ✅     | better-sqlite3, WAL mode           |
| PostgreSQL adapter     | ✅     | Via Drizzle                        |
| Auto schema generation | ✅     | From collections                   |
| Migrations             | ✅     | Drizzle Kit                        |
| Transactions           | ✅     | Full support with rollback on error|
| MySQL adapter          | ❌     | Not implemented                    |
| MongoDB adapter        | ❌     | Not implemented                    |

### Authentication

| Feature            | Status | Notes                              |
| ------------------ | ------ | ---------------------------------- |
| Email/password     | ✅     | Better Auth                        |
| Sessions           | ✅     | Cookie-based                       |
| Roles              | ✅     | Custom role field                  |
| Token expiration   | ✅     | Configurable                       |
| Email verification | ✅     | Full flow with Mailpit E2E tests   |
| Password reset     | ✅     | Full flow with email templates     |
| OAuth providers    | ✅     | Google, GitHub via Better Auth     |
| Two-factor auth    | ✅     | TOTP with QR code setup            |
| API keys           | ✅     | Create, list, delete, role-scoped  |

### Admin UI

| Feature            | Status | Notes                              |
| ------------------ | ------ | ---------------------------------- |
| Dashboard          | ✅     | Overview page                      |
| Collection list    | ✅     | Paginated, sortable                |
| Document view      | ✅     | Read-only display                  |
| Document edit      | ✅     | Form-based editing                 |
| Login/logout       | ✅     | Auth flow                          |
| Setup wizard       | ✅     | First-run setup                    |
| Dark mode          | ✅     | Theme toggle                       |
| Sidebar navigation | ✅     | Collection groups                  |
| Media library page | ✅     | Upload, preview, delete            |
| Version history    | ✅     | List, view, restore, compare       |
| Version diff       | ✅     | Field-by-field comparison dialog   |
| Publish controls   | ✅     | Publish/unpublish/draft/schedule   |
| Command palette    | ✅     | Keyboard nav, filtering, autofocus |
| UI component lib   | ✅     | 38+ components with Storybook      |
| Locale switcher    | ✅     | Dropdown in entity form for i18n   |
| Live preview       | ✅     | Iframe, postMessage, device toggle |
| Custom branding    | ✅     | Logo/title config                  |
| Custom components  | ❌     | Not extensible                     |
| Custom views       | ❌     | Not extensible                     |

---

## Priority Features

### 1. Upload/Media Management

| Feature               | Status | Notes                    |
| --------------------- | ------ | ------------------------ |
| File upload endpoint  | ✅     | Done                     |
| Local storage adapter | ✅     | Done                     |
| S3 storage adapter    | ✅     | Done                     |
| Image resizing        | 🚫     | Won't do (no Sharp dep)  |
| Image focal points    | 🚫     | Won't do (no Sharp dep)  |
| Media library UI      | ✅     | Done                     |
| MIME type detection   | ✅     | Done                     |
| File size limits      | ✅     | Done                     |

### 2. Versioning & Drafts

| Feature                   | Status | Notes                         |
| ------------------------- | ------ | ----------------------------- |
| Version history           | ✅     | Done                          |
| Restore version           | ✅     | Done                          |
| Compare versions          | ✅     | Field-by-field diff dialog    |
| Draft status field        | ✅     | Done                          |
| Auto-save drafts          | ✅     | Done                          |
| Scheduled publishing      | ✅     | Background scheduler + UI     |
| Publish/unpublish actions | ✅     | Done                          |

### 3. Localization (i18n)

| Feature                  | Status | Notes                              |
| ------------------------ | ------ | ---------------------------------- |
| Locale config            | ✅     | Multi-locale with default/fallback |
| Field-level localization | ✅     | Per-field `localized` flag         |
| Locale switcher UI       | ✅     | Dropdown in entity form            |
| Fallback locales         | ✅     | Configurable fallback chain        |
| RTL support              | ❌     | Not implemented                    |

### 4. Live Preview

| Feature                | Status | Notes                              |
| ---------------------- | ------ | ---------------------------------- |
| Preview URL generation | ✅     | Done                               |
| Live preview iframe    | ✅     | Iframe with postMessage sync       |
| Real-time updates      | ✅     | Debounced form data broadcasting   |
| Device size toggle     | ✅     | Desktop/tablet/mobile presets      |

### 5. Rich Text Editor

| Feature               | Status | Notes                              |
| --------------------- | ------ | ---------------------------------- |
| TipTap integration    | ✅     | ProseMirror-based editor           |
| Bold/italic/underline | ✅     | Formatting toolbar                 |
| Headings              | ✅     | H1-H6 support                     |
| Lists                 | ✅     | Ordered and unordered              |
| Links                 | ✅     | Link insertion/editing             |
| Images                | ❌     | Not implemented                    |
| Inline blocks         | ❌     | Not implemented                    |
| Custom plugins        | ❌     | Not implemented                    |

### 6. API Features

| Feature              | Status | Notes                              |
| -------------------- | ------ | ---------------------------------- |
| REST API             | ✅     | Done                               |
| GraphQL API          | ✅     | Queries, mutations, introspection  |
| OpenAPI/Swagger docs | ✅     | Auto-generated from collections    |
| Batch operations     | ✅     | Batch create/update/delete         |
| Full-text search     | ✅     | tsvector/tsquery with GIN index    |
| Webhooks             | ✅     | CRUD events with HMAC signatures   |

### 7. Developer Experience

| Feature           | Status | Notes                              |
| ----------------- | ------ | ---------------------------------- |
| Seeding system    | ✅     | Done                               |
| Local API (typed) | ✅     | Done                               |
| Plugin system     | ❌     | Not implemented                    |
| Custom validators | ✅     | Done                               |
| Migration tools   | ✅     | Done                               |
| Import/export     | ✅     | JSON and CSV with round-trip       |

---

## Comparison: Payload CMS Feature Parity

| Category     | Payload    | Momentum         | Gap         |
| ------------ | ---------- | ---------------- | ----------- |
| Field types  | 20+        | 20               | ✅ Done     |
| Upload/Media | Full       | Core (no resize) | 🟡 Medium   |
| Versioning   | Full       | Full             | ✅ Done     |
| Drafts       | Full       | Full             | ✅ Done     |
| Localization | Full       | Full             | ✅ Done     |
| Live Preview | Full       | Full             | ✅ Done     |
| GraphQL      | Full       | Full             | ✅ Done     |
| Rich Text    | Lexical    | TipTap           | ✅ Done     |
| Search       | Full-text  | Full-text        | ✅ Done     |
| Auth         | OAuth, 2FA | OAuth, 2FA, Keys | ✅ Done     |
| Plugins      | Full       | None             | 🟢 Low      |

---

## Implementation Roadmap

### Phase 1: Core Content Features

- [x] Upload/Media management
- [x] Versioning system
- [x] Drafts & publishing

### Phase 2: Multi-language & Preview

- [x] Localization (i18n)
- [x] Live preview

### Phase 3: Editor & API

- [x] Rich text editor (TipTap)
- [x] Blocks field completion
- [x] GraphQL API

### Phase 4: Polish

- [x] Full-text search
- [x] Email verification
- [x] Batch operations
- [x] Webhooks
- [x] Import/Export
- [x] OpenAPI docs
- [x] OAuth providers
- [x] Two-factor auth
- [x] API keys
- [x] Scheduled publishing
- [x] Version diff UI
- [x] Locale switcher UI
- [x] Accessibility audit
