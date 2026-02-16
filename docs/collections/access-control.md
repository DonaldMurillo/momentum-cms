# Access Control

Restrict who can perform operations on your collections.

## Collection-Level Access

```typescript
import { defineCollection } from '@momentum-cms/core';

export const Posts = defineCollection({
	slug: 'posts',
	access: {
		create: ({ req }) => !!req.user,
		read: () => true,
		update: ({ req }) => req.user?.role === 'admin',
		delete: ({ req }) => req.user?.role === 'admin',

		// Soft delete access
		restore: ({ req }) => req.user?.role === 'admin',
		forceDelete: ({ req }) => req.user?.role === 'admin',

		// Version access
		readVersions: ({ req }) => !!req.user,
		publishVersions: ({ req }) => req.user?.role === 'admin',
		restoreVersions: ({ req }) => req.user?.role === 'admin',

		// Admin panel access
		admin: ({ req }) => req.user?.role === 'admin',
		unlock: ({ req }) => req.user?.role === 'admin',
	},
	fields: [],
});
```

## Access Function Signature

```typescript
type AccessFunction = (args: {
	req: { user?: { id; email?; role?; [key]: unknown }; headers?: Record<string, string> };
	id?: string | number; // Document ID (update/delete)
	data?: Record<string, unknown>; // Document data (create/update)
}) => boolean | Promise<boolean>;
```

## Pre-Built Helpers

Import from `@momentum-cms/core`:

```typescript
import {
	allowAll,
	denyAll,
	isAuthenticated,
	hasRole,
	hasAnyRole,
	hasAllRoles,
	isOwner,
	and,
	or,
	not,
	access,
} from '@momentum-cms/core';
```

### Basic Helpers

| Helper                               | Description                                 |
| ------------------------------------ | ------------------------------------------- |
| `allowAll()`                         | Anyone (public access)                      |
| `denyAll()`                          | No one                                      |
| `isAuthenticated()`                  | Any logged-in user                          |
| `hasRole('admin')`                   | User with specific role                     |
| `hasAnyRole(['admin', 'editor'])`    | User with any of the roles                  |
| `hasAllRoles(['verified', 'admin'])` | User with all roles (multi-role systems)    |
| `isOwner()`                          | Document creator (checks `createdBy` field) |
| `isOwner('authorId')`                | Document owner by custom field              |

### Combinators

```typescript
access: {
  // Both conditions must pass
  update: and(isAuthenticated(), hasAnyRole(['admin', 'editor'])),

  // Either condition passes
  read: or(allowAll(), hasRole('admin')),

  // Negate a condition
  create: not(hasRole('banned')),

  // Complex composition
  delete: or(hasRole('admin'), and(isAuthenticated(), isOwner())),
}
```

### Typed Custom Access

Use `access<TUser>()` for full IntelliSense on user properties:

```typescript
interface MyUser {
  id: string;
  role: 'admin' | 'editor' | 'viewer';
  teamId: string;
}

access: {
  read: access<MyUser>(({ user }) => user?.teamId === 'team-1'),
  create: access<MyUser>(({ user }) => user?.role !== 'viewer'),
}
```

## Field-Level Access

Restrict access to individual fields:

```typescript
text('internalNotes', {
	access: {
		create: hasRole('admin'),
		read: hasAnyRole(['admin', 'editor']),
		update: hasRole('admin'),
	},
});
```

## Related

- [Roles & Permissions](../auth/roles-and-permissions.md) — Role-based access patterns
- [Hooks](hooks.md) — Run logic alongside access checks
