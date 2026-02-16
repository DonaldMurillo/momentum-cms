# Admin Dashboard

The admin library (`@momentumcms/admin`) provides a pre-built Angular dashboard for managing collections, globals, and media.

## Package

```bash
npm install @momentumcms/admin
```

## Setup

Register admin routes in your Angular app:

```typescript
import { momentumAdminRoutes } from '@momentumcms/admin';
import momentumConfig from './momentum.config';

const routes: Routes = [
	...momentumAdminRoutes(momentumConfig),
	// Your other routes...
];
```

## Dashboard Pages

| Route                               | Page              | Description                   |
| ----------------------------------- | ----------------- | ----------------------------- |
| `/admin`                            | Dashboard         | Grid of collection cards      |
| `/admin/login`                      | Login             | Email/password authentication |
| `/admin/setup`                      | Setup             | First-user registration       |
| `/admin/collections/:slug`          | Collection List   | Paginated document list       |
| `/admin/collections/:slug/new`      | Collection Create | New document form             |
| `/admin/collections/:slug/:id`      | Collection View   | Document detail view          |
| `/admin/collections/:slug/:id/edit` | Collection Edit   | Document edit form            |
| `/admin/globals/:slug`              | Global Edit       | Singleton document editor     |
| `/admin/media`                      | Media Library     | File upload and management    |

## Route Guards

The admin uses several guards automatically:

- **authGuard** — Redirects unauthenticated users to login
- **guestGuard** — Redirects authenticated users away from login/setup
- **setupGuard** — Only allows access when no users exist
- **collectionAccessGuard** — Enforces collection-level access control
- **unsavedChangesGuard** — Prompts before navigating away from unsaved edits

## Admin Shell

The shell component provides:

- **Responsive sidebar** with collection/global navigation
- **Mobile header** with hamburger menu
- **Entity sheet** for inline create/edit modals (query-param driven)
- **Toast notifications** for user feedback
- **Keyboard shortcuts** (Cmd/Ctrl+B to toggle sidebar)

## Sidebar Navigation

Collections and globals are grouped by their `admin.group` property:

```typescript
export const Posts = defineCollection({
	slug: 'posts',
	admin: {
		group: 'Content',
		icon: 'heroNewspaper',
		hidden: false,
	},
	fields: [],
});
```

The sidebar also shows:

- Dashboard link at the top
- Plugin-registered routes
- User menu with theme toggle and sign out

## Plugin Routes

Plugins can register admin pages:

```typescript
const myPlugin: MomentumPlugin = {
	name: 'my-plugin',
	adminRoutes: [
		{
			path: 'my-page',
			loadComponent: () => import('./my-page.component'),
			label: 'My Page',
			icon: 'heroChartBarSquare',
			group: 'Analytics',
		},
	],
};
```

## Related

- [API Service](api-service.md) — Data access from components
- [Theme](theme.md) — Dark mode and theming
- [Tailwind Setup](tailwind-setup.md) — Styling configuration
