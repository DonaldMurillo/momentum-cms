# Roles & Permissions

Implement role-based access control in Momentum CMS.

## Default Roles

Users have a `role` field. Common roles:

| Role    | Description                                    |
| ------- | ---------------------------------------------- |
| `admin` | Full access to all collections and admin panel |
| `user`  | Standard authenticated user                    |

## Using Access Helpers

```typescript
import {
	allowAll,
	isAuthenticated,
	hasRole,
	hasAnyRole,
	isOwner,
	and,
	or,
	not,
} from '@momentum-cms/core';

export const Posts = defineCollection({
	slug: 'posts',
	access: {
		read: allowAll(), // Public
		create: isAuthenticated(), // Any user
		update: or(hasRole('admin'), isOwner()), // Admin or author
		delete: hasRole('admin'), // Admin only
		admin: hasAnyRole(['admin', 'editor']), // Admin panel access
	},
	fields: [],
});
```

## Custom Role System

Define a custom user type for IntelliSense:

```typescript
import { access } from '@momentum-cms/core';

interface AppUser {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
  teamId: string;
  permissions: string[];
}

access: {
  read: access<AppUser>(({ user }) =>
    user?.permissions.includes('posts:read') ?? false
  ),
  update: access<AppUser>(({ user }) =>
    user?.role === 'admin' || user?.teamId === 'content-team'
  ),
}
```

## Multi-Role Example

```typescript
import { and, or, hasRole, isAuthenticated, isOwner } from '@momentum-cms/core';

export const Articles = defineCollection({
	slug: 'articles',
	access: {
		read: allowAll(),
		create: hasAnyRole(['admin', 'editor', 'author']),
		update: or(hasRole('admin'), and(hasAnyRole(['editor', 'author']), isOwner())),
		delete: hasRole('admin'),
	},
	fields: [],
});
```

## Related

- [Access Control](../collections/access-control.md) — Full access control reference
- [Configuration](configuration.md) — Auth setup
