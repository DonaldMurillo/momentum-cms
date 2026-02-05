# Momentum CMS Features

> Feature tracking document comparing Momentum CMS with Payload CMS capabilities.

## Legend

- ✅ Implemented
- 🚧 Partial (types/structure exist)
- ❌ Not Started
- 🎯 Priority Target

---

## Core Features

### Field Types

| Field        | Status | Notes                               |
| ------------ | ------ | ----------------------------------- |
| text         | ✅     | With validation, placeholder        |
| textarea     | ✅     | Multi-line text                     |
| richText     | 🚧     | Basic only, needs Lexical editor    |
| email        | ✅     | With email validation               |
| password     | ✅     | Hashed storage                      |
| slug         | ✅     | Auto-generated from title           |
| number       | ✅     | min/max/step support                |
| checkbox     | ✅     | Boolean field                       |
| date         | ✅     | Date picker                         |
| select       | ✅     | Single/multi select                 |
| radio        | ✅     | Radio button group                  |
| relationship | ✅     | Lazy refs, hasMany                  |
| array        | 🚧     | Defined, admin rendering incomplete |
| group        | 🚧     | Defined, admin rendering incomplete |
| blocks       | 🚧     | Types defined, rendering incomplete |
| json         | ✅     | Arbitrary JSON storage              |
| point        | ✅     | Lat/lng geolocation                 |
| upload       | ✅     | File upload with storage adapters   |
| tabs         | ❌     | Layout field for form organization  |
| collapsible  | ❌     | Collapsible field group             |
| row          | ❌     | Horizontal field layout             |
| ui           | ❌     | Custom UI components in forms       |

### Collection System

| Feature              | Status | Notes                           |
| -------------------- | ------ | ------------------------------- |
| defineCollection()   | ✅     | Full collection config          |
| defineGlobal()       | ✅     | Singleton documents             |
| Custom slugs         | ✅     | kebab-case enforced             |
| Admin config         | ✅     | useAsTitle, columns, pagination |
| Custom endpoints     | 🚧     | Structure defined, not wired    |
| TypeScript inference | ✅     | Full type safety                |

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

| Feature                | Status | Notes                    |
| ---------------------- | ------ | ------------------------ |
| SQLite adapter         | ✅     | better-sqlite3, WAL mode |
| PostgreSQL adapter     | ✅     | Via Drizzle              |
| Auto schema generation | ✅     | From collections         |
| Migrations             | ✅     | Drizzle Kit              |
| Transactions           | 🚧     | Basic support            |
| MySQL adapter          | ❌     | Not implemented          |
| MongoDB adapter        | ❌     | Not implemented          |

### Authentication

| Feature            | Status | Notes                              |
| ------------------ | ------ | ---------------------------------- |
| Email/password     | ✅     | Better Auth                        |
| Sessions           | ✅     | Cookie-based                       |
| Roles              | ✅     | Custom role field                  |
| Token expiration   | ✅     | Configurable                       |
| Email verification | 🚧     | Config exists, email adapter added |
| Password reset     | ✅     | Full flow with email templates     |
| OAuth providers    | ❌     | Not implemented                    |
| Two-factor auth    | ❌     | Not implemented                    |
| API keys           | ❌     | Machine auth                       |

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
| Version history    | ✅     | List, view, restore widget         |
| Publish controls   | ✅     | Publish/unpublish/draft buttons    |
| Command palette    | ✅     | Keyboard nav, filtering, autofocus |
| UI component lib   | ✅     | 38+ components with Storybook      |
| Custom branding    | 🚧     | Logo/title only                    |
| Custom components  | ❌     | Not extensible                     |
| Custom views       | ❌     | Not extensible                     |

---

## 🎯 Priority Features

### 1. Upload/Media Management

| Feature               | Status | Priority                 |
| --------------------- | ------ | ------------------------ |
| File upload endpoint  | ✅     | Done                     |
| Local storage adapter | ✅     | Done                     |
| S3 storage adapter    | ✅     | Done                     |
| Image resizing        | ❌     | High                     |
| Image focal points    | 🚧     | Field exists, no crop UI |
| Media library UI      | ✅     | Done                     |
| MIME type detection   | ✅     | Done                     |
| File size limits      | ✅     | Done                     |

### 2. Versioning & Drafts

| Feature                   | Status | Priority                        |
| ------------------------- | ------ | ------------------------------- |
| Version history           | ✅     | Done                            |
| Restore version           | ✅     | Done                            |
| Compare versions          | 🚧     | Server logic exists, no diff UI |
| Draft status field        | ✅     | Done                            |
| Auto-save drafts          | ✅     | Done                            |
| Scheduled publishing      | 🚧     | Types exist, no scheduler       |
| Publish/unpublish actions | ✅     | Done                            |

### 3. Localization (i18n)

| Feature                  | Status | Priority    |
| ------------------------ | ------ | ----------- |
| Locale config            | ❌     | 🎯 Critical |
| Field-level localization | ❌     | 🎯 Critical |
| Locale switcher UI       | ❌     | 🎯 Critical |
| Fallback locales         | ❌     | Medium      |
| RTL support              | ❌     | Low         |

### 4. Live Preview

| Feature                | Status | Priority    |
| ---------------------- | ------ | ----------- |
| Preview URL generation | 🚧     | Done        |
| Live preview iframe    | ❌     | 🎯 Critical |
| Real-time updates      | ❌     | 🎯 Critical |
| Device size toggle     | ❌     | Medium      |

### 5. Rich Text Editor

| Feature               | Status | Priority    |
| --------------------- | ------ | ----------- |
| Lexical integration   | ❌     | 🎯 Critical |
| Bold/italic/underline | ❌     | 🎯 Critical |
| Headings              | ❌     | 🎯 Critical |
| Lists                 | ❌     | 🎯 Critical |
| Links                 | ❌     | 🎯 Critical |
| Images                | ❌     | High        |
| Inline blocks         | ❌     | Medium      |
| Custom plugins        | ❌     | Low         |

### 6. API Features

| Feature              | Status | Priority |
| -------------------- | ------ | -------- |
| REST API             | ✅     | Done     |
| GraphQL API          | 🚧     | High     |
| OpenAPI/Swagger docs | ❌     | Medium   |
| Batch operations     | ❌     | Medium   |
| Full-text search     | ❌     | High     |
| Webhooks             | ❌     | Medium   |

### 7. Developer Experience

| Feature           | Status | Priority |
| ----------------- | ------ | -------- |
| Seeding system    | ✅     | Done     |
| Local API (typed) | ✅     | Done     |
| Plugin system     | ❌     | Low      |
| Custom validators | ✅     | Done     |
| Migration tools   | ✅     | Done     |
| Import/export     | ❌     | Low      |

---

## Comparison: Payload CMS Feature Parity

| Category     | Payload    | Momentum      | Gap         |
| ------------ | ---------- | ------------- | ----------- |
| Field types  | 20+        | 16            | 4 missing   |
| Upload/Media | Full       | Core complete | 🟡 Medium   |
| Versioning   | Full       | Full          | ✅ Done     |
| Drafts       | Full       | Full          | ✅ Done     |
| Localization | Full       | None          | 🔴 Critical |
| Live Preview | Full       | Preview URL   | 🟡 Medium   |
| GraphQL      | Full       | Types only    | 🟡 Medium   |
| Rich Text    | Lexical    | Basic         | 🟡 Medium   |
| Search       | Full-text  | WHERE only    | 🟡 Medium   |
| Auth         | OAuth, 2FA | Email+Reset   | 🟢 Low      |
| Plugins      | Full       | None          | 🟢 Low      |

---

## Implementation Roadmap

### Phase 1: Core Content Features

- [x] Upload/Media management
- [x] Versioning system
- [x] Drafts & publishing

### Phase 2: Multi-language & Preview

- [ ] Localization (i18n)
- [ ] Live preview

### Phase 3: Editor & API

- [ ] Rich text editor (Lexical)
- [ ] Blocks field completion
- [ ] GraphQL API

### Phase 4: Polish

- [ ] Full-text search
- [ ] Email adapter
- [ ] Batch operations
