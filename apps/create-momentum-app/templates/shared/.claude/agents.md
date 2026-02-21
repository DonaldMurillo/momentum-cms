# Momentum CMS - AI Agent Reference

This document is a reference for AI agents working on a Momentum CMS project.

## Overview

Momentum CMS is a headless CMS built with Angular. You define collections in TypeScript, and the framework auto-generates an Admin UI, REST API, and database schema.

**Core concepts:**

- **Collections**: Data models defined with `defineCollection()` that become DB tables, REST endpoints, and admin CRUD pages
- **Fields**: Typed field builders (`text`, `richText`, `number`, `blocks`, `relationship`, etc.)
- **Blocks**: Composable content blocks within a collection (e.g., hero, text, feature grid)
- **Plugins**: Extensions that add collections, hooks, middleware, and admin routes
- **Access Control**: Per-operation auth (`read`, `create`, `update`, `delete`) on every collection
- **Globals**: Singleton documents (site settings, navigation, etc.)

## Available Skills

| Skill                | Usage                      | Description                                                      |
| -------------------- | -------------------------- | ---------------------------------------------------------------- |
| `/collection <name>` | `/collection products`     | Generate a new collection with fields, access control, and hooks |
| `/momentum-api <op>` | `/momentum-api crud posts` | Guide for using `injectMomentumAPI()` in Angular components      |
| `/add-plugin <name>` | `/add-plugin analytics`    | Add and configure a Momentum CMS plugin                          |

## Common Workflows

### Add a New Collection

1. Create `src/collections/<name>.collection.ts` using `defineCollection()`
2. Import and add to the `collections` array in `src/momentum.config.ts`
3. Run `npm run generate` to regenerate types and admin config
4. Run `npm run migrate:generate` to create a migration (if using migrations)
5. Restart the dev server

### Add a Block to a Collection

1. Import `blocks` from `@momentumcms/core`
2. Add a `blocks('fieldName', { blocks: [...] })` field to your collection
3. Each block needs: `slug`, `labels`, and `fields`
4. Run `npm run generate` to update types

### Add a Plugin

1. Install: `npm install @momentumcms/plugins-<name>`
2. Import the plugin factory in `src/momentum.config.ts`
3. Add to `plugins: [...]` array
4. Run `npm run generate` to pick up browser imports
5. Restart dev server

### Run Migrations

```bash
npm run migrate:generate           # Diff schema and create migration file
npm run migrate:run                # Apply pending migrations
npm run migrate:status             # Check applied vs pending
npm run migrate:rollback           # Rollback latest batch
```

### Generate Types

```bash
npm run generate                   # Generate types + admin config
```

## Architecture

```
momentum.config.ts                 # Source of truth
    |
    ├── npm run generate
    |   ├── src/generated/momentum.types.ts    # TypeScript interfaces
    |   └── src/generated/momentum.config.ts   # Browser-safe admin config
    |
    ├── Server (Express/Analog)
    |   ├── REST API at /api/<collection>
    |   └── Auth at /api/auth/*
    |
    └── Admin UI at /admin
        ├── Auto-generated CRUD pages
        └── Plugin admin routes
```

## Code Conventions

- **Signals** for state: `signal()`, `computed()`, `effect()`
- **Signal inputs/outputs**: `input()`, `input.required()`, `output()`
- **`inject()` function**, not constructor injection
- **OnPush** change detection for all components
- **Control flow**: `@if`, `@for`, `@switch` (not `*ngIf`/`*ngFor`)
- **Don't add `standalone: true`** (default in Angular 21)
- **kebab-case** filenames, **PascalCase** classes
- **`.collection.ts`** suffix for collection files (e.g., `posts.collection.ts`)

## Key Commands

| Command                    | Description                      |
| -------------------------- | -------------------------------- |
| `npm run dev`              | Start dev server with hot reload |
| `npm run build`            | Production build                 |
| `npm start`                | Start production server          |
| `npm run generate`         | Generate types and admin config  |
| `npm run migrate:generate` | Create a new migration           |
| `npm run migrate:run`      | Apply pending migrations         |
| `npm run migrate:status`   | Show migration status            |
| `npm run migrate:rollback` | Rollback latest migration batch  |

## Directory Layout

```
src/
  collections/              # Collection definitions (*.collection.ts)
  generated/                # Auto-generated types and admin config (don't edit)
    momentum.types.ts       # TypeScript interfaces for all collections
    momentum.config.ts      # Browser-safe admin config
  momentum.config.ts        # Central config (db, auth, collections, plugins)
  server.ts                 # Server entry point (Express) or server/ (Analog)
  app/                      # Angular app components and routes
  styles.css                # Tailwind + Momentum theme variables
```

## Field Types Quick Reference

| Field          | Import                                          | Description             |
| -------------- | ----------------------------------------------- | ----------------------- |
| `text`         | `text(name, opts)`                              | Short text              |
| `textarea`     | `textarea(name, opts)`                          | Multi-line text         |
| `richText`     | `richText(name, opts)`                          | Rich text editor (HTML) |
| `number`       | `number(name, opts)`                            | Numeric value           |
| `date`         | `date(name, opts)`                              | Date/datetime           |
| `checkbox`     | `checkbox(name, opts)`                          | Boolean                 |
| `select`       | `select(name, { options })`                     | Dropdown                |
| `email`        | `email(name, opts)`                             | Email with validation   |
| `upload`       | `upload(name, { relationTo })`                  | File upload             |
| `relationship` | `relationship(name, { collection: () => Ref })` | FK reference            |
| `array`        | `array(name, { fields })`                       | Repeating sub-fields    |
| `group`        | `group(name, { fields })`                       | Nested field group      |
| `blocks`       | `blocks(name, { blocks })`                      | Content blocks          |
| `json`         | `json(name, opts)`                              | Raw JSON                |
| `slug`         | `slug(name, { from })`                          | Auto-generated slug     |
