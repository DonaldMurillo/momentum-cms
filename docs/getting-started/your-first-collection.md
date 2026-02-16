# Your First Collection

Walk through creating a collection from scratch, generating the database schema, and using it.

## 1. Define the Collection

Create `src/collections/pages.ts`:

```typescript
import { defineCollection, text, richText, slug, select, checkbox } from '@momentumcms/core';

export const Pages = defineCollection({
	slug: 'pages',

	admin: {
		useAsTitle: 'title',
		defaultColumns: ['title', 'status', 'updatedAt'],
		group: 'Content',
	},

	access: {
		read: () => true,
		create: ({ req }) => !!req.user,
		update: ({ req }) => !!req.user,
		delete: ({ req }) => req.user?.role === 'admin',
	},

	fields: [
		text('title', { required: true }),
		slug('slug', { from: 'title' }),
		richText('content'),
		select('status', {
			options: [
				{ label: 'Draft', value: 'draft' },
				{ label: 'Published', value: 'published' },
			],
			defaultValue: 'draft',
		}),
		checkbox('featured'),
	],
});
```

## 2. Register It

Add the collection to your `momentum.config.ts`:

```typescript
import { Posts } from './collections/posts';
import { Pages } from './collections/pages';

export default {
	// ...
	collections: [Posts, Pages],
};
```

## 3. Generate the Database Schema

```bash
npx drizzle-kit generate   # Creates SQL migration files
npx drizzle-kit push        # Apply directly (dev only)
# OR
npx drizzle-kit migrate     # Apply migrations (production)
```

## 4. Use It

Restart your dev server. The admin dashboard now shows:

- **Pages** in the sidebar under "Content"
- Full CRUD interface with title, slug, content, status, and featured fields
- List view with the configured default columns

The REST API is available at `/api/pages`:

```bash
# List pages
curl http://localhost:4200/api/pages

# Create a page
curl -X POST http://localhost:4200/api/pages \
  -H "Content-Type: application/json" \
  -d '{"title": "About Us", "content": "..."}'

# Get a single page
curl http://localhost:4200/api/pages/:id

# Update
curl -X PATCH http://localhost:4200/api/pages/:id \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'

# Delete
curl -X DELETE http://localhost:4200/api/pages/:id
```

## 5. Query in Angular Components

```typescript
import { Component, signal } from '@angular/core';
import { injectMomentumAPI } from '@momentumcms/admin';

@Component({
	selector: 'app-pages',
	template: `
		@for (page of pages(); track page.id) {
			<h2>{{ page.title }}</h2>
		}
	`,
})
export class PagesComponent {
	private readonly api = injectMomentumAPI();
	readonly pages = signal<any[]>([]);

	constructor() {
		this.api
			.collection('pages')
			.find$({ limit: 10 })
			.subscribe((result) => this.pages.set(result.docs));
	}
}
```

## Next Steps

- [Fields Reference](../collections/fields.md) — All 20 field types
- [Access Control](../collections/access-control.md) — Fine-grained permissions
- [Hooks](../collections/hooks.md) — Run logic before/after operations
