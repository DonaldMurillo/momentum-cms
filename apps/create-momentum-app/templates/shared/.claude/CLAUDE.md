# Momentum CMS App

Angular-based headless CMS application built with [Momentum CMS](https://github.com/momentum-cms/momentum-cms).

For comprehensive AI agent reference (skills, workflows, architecture), see [agents.md](agents.md).

## Tech Stack

- Angular 21 (SSR) with Express or Analog.js (Nitro)
- Drizzle ORM (PostgreSQL or SQLite)
- Better Auth for authentication
- Tailwind CSS for styling

## Commands

```bash
npm run dev                    # Start dev server
npm run build                  # Production build
npm start                      # Start production server
npm run generate               # Generate types and admin config
npm run migrate:generate       # Create a migration from schema changes
npm run migrate:run            # Apply pending migrations
npm run migrate:status         # Show migration status
npm run migrate:rollback       # Rollback latest migration batch
```

## Project Structure

```
src/
  collections/       # Collection definitions (*.collection.ts)
  generated/         # Auto-generated types and admin config (don't edit)
  momentum.config.ts # Central configuration (db, auth, collections, plugins)
  server.ts          # Server entry point (Express) or server/ (Analog)
  app/               # Angular app components and routes
  styles.css         # Tailwind + Momentum theme variables
```

## Defining Collections

Collections are the core data model. Each collection generates a database table, REST API, and admin UI.

```typescript
import { defineCollection, text, richText, select, blocks } from '@momentumcms/core';

export const Posts = defineCollection({
	slug: 'posts',
	admin: { useAsTitle: 'title', group: 'Content' },
	access: {
		read: () => true,
		create: ({ req }) => !!req.user,
		update: ({ req }) => req.user?.role === 'admin',
		delete: ({ req }) => req.user?.role === 'admin',
	},
	fields: [
		text('title', { required: true }),
		richText('content'),
		select('status', {
			options: [
				{ label: 'Draft', value: 'draft' },
				{ label: 'Published', value: 'published' },
			],
			defaultValue: 'draft',
		}),
		blocks('pageContent', {
			label: 'Page Content',
			blocks: [
				{
					slug: 'contentBlock',
					labels: { singular: 'Content Block', plural: 'Content Blocks' },
					fields: [text('heading'), richText('body', { required: true })],
				},
			],
		}),
	],
});
```

### Adding a New Collection

1. Create `src/collections/<name>.collection.ts` with `defineCollection()`
2. Add to `collections` array in `momentum.config.ts`
3. Run `npm run generate` to regenerate types and admin config
4. Run `npm run migrate:generate` to create a migration
5. Restart dev server

### Field Types

| Field          | Import                                          | Description             |
| -------------- | ----------------------------------------------- | ----------------------- |
| `text`         | `text(name, opts)`                              | Short text string       |
| `textarea`     | `textarea(name, opts)`                          | Multi-line text         |
| `richText`     | `richText(name, opts)`                          | Rich text editor (HTML) |
| `number`       | `number(name, opts)`                            | Numeric value           |
| `date`         | `date(name, opts)`                              | Date/datetime           |
| `checkbox`     | `checkbox(name, opts)`                          | Boolean                 |
| `select`       | `select(name, { options })`                     | Dropdown select         |
| `radio`        | `radio(name, { options })`                      | Radio buttons           |
| `email`        | `email(name, opts)`                             | Email with validation   |
| `password`     | `password(name, opts)`                          | Password field          |
| `upload`       | `upload(name, { relationTo })`                  | File upload             |
| `relationship` | `relationship(name, { collection: () => Ref })` | FK reference            |
| `array`        | `array(name, { fields })`                       | Repeating sub-fields    |
| `group`        | `group(name, { fields })`                       | Nested field group      |
| `blocks`       | `blocks(name, { blocks })`                      | Content blocks          |
| `json`         | `json(name, opts)`                              | Raw JSON                |
| `point`        | `point(name, opts)`                             | Geolocation             |
| `slug`         | `slug(name, { from })`                          | Auto-generated slug     |

### Access Control Helpers

```typescript
import { allowAll, isAuthenticated, hasRole, hasAnyRole, isOwner, and, or, not } from '@momentumcms/core';

access: {
  read: allowAll(),
  create: isAuthenticated(),
  update: or(hasRole('admin'), isOwner()),
  delete: hasRole('admin'),
}
```

## Using the API in Components

```typescript
import { injectMomentumAPI } from '@momentumcms/admin';

@Component({...})
export class MyComponent {
  private readonly api = injectMomentumAPI();

  // Observable
  readonly posts$ = this.api.collection<Post>('posts').find$({ limit: 10 });

  // Promise
  async load(): Promise<void> {
    const result = await this.api.collection<Post>('posts').find({ limit: 10 });
  }

  // CRUD
  async create(): Promise<void> {
    await this.api.collection<Post>('posts').create({ title: 'New' });
  }
}
```

## Code Style

- **Signals for state**: `signal()`, `computed()`, `effect()`
- **Signal inputs/outputs**: `input()`, `input.required()`, `output()`
- **inject() function**, not constructor injection
- **OnPush change detection** for all components
- **Control flow**: `@if`, `@for`, `@switch`
- Don't add `standalone: true` (default in Angular 21)
- Use kebab-case filenames, PascalCase classes
- Collection files use `.collection.ts` suffix (e.g., `posts.collection.ts`)

## REST API

All collections get auto-generated endpoints:

| Method | Path                   | Description                            |
| ------ | ---------------------- | -------------------------------------- |
| GET    | `/api/:collection`     | List (query: limit, page, sort, where) |
| GET    | `/api/:collection/:id` | Get by ID                              |
| POST   | `/api/:collection`     | Create                                 |
| PATCH  | `/api/:collection/:id` | Update                                 |
| DELETE | `/api/:collection/:id` | Delete                                 |

## Documentation

Full docs: https://github.com/DonaldMurillo/momentum-cms#readme
