# Hooks

Lifecycle hooks let you run custom logic before or after collection operations.

## Collection-Level Hooks

```typescript
export const Posts = defineCollection({
	slug: 'posts',
	hooks: {
		beforeValidate: [],
		beforeChange: [],
		afterChange: [],
		beforeRead: [],
		afterRead: [],
		beforeDelete: [],
		afterDelete: [],
		beforeRestore: [], // Soft delete restore
		afterRestore: [], // Soft delete restore
	},
	fields: [],
});
```

## Hook Function Signature

```typescript
type HookFunction = (args: {
	req: { user?; headers? };
	data?: Record<string, unknown>; // Incoming data (create/update)
	doc?: Record<string, unknown>; // Existing document
	operation?: 'create' | 'update' | 'delete' | 'softDelete' | 'restore';
	originalDoc?: Record<string, unknown>; // Document before changes
}) => Record<string, unknown> | void | Promise<Record<string, unknown> | void>;
```

## Execution Order

1. **beforeValidate** — Modify data before validation runs
2. **beforeChange** — Modify data after validation, before database write
3. _(database operation)_
4. **afterChange** — Run side effects after write (send emails, update cache)

For reads: **beforeRead** → _(query)_ → **afterRead**

For deletes: **beforeDelete** → _(delete)_ → **afterDelete**

## Returning Data

`before*` hooks can return modified data that replaces the incoming payload:

```typescript
hooks: {
  beforeChange: [
    ({ data, req, operation }) => {
      if (operation === 'create') {
        return { ...data, createdBy: req.user?.id };
      }
      return data;
    },
  ],
}
```

## Examples

### Auto-set author on create

```typescript
beforeChange: [
	({ data, req, operation }) => {
		if (operation === 'create' && req.user) {
			return { ...data, authorId: req.user.id };
		}
	},
];
```

### Log changes

```typescript
afterChange: [
	({ doc, operation, originalDoc }) => {
		console.warn(`[${operation}] Document ${doc?.id} changed`);
	},
];
```

### Transform data on read

```typescript
afterRead: [
	({ doc }) => {
		if (doc) {
			return { ...doc, fullName: `${doc.firstName} ${doc.lastName}` };
		}
	},
];
```

## Field-Level Hooks

Individual fields can also have hooks:

```typescript
text('title', {
	hooks: {
		beforeValidate: [(args) => args.value?.trim()],
		beforeChange: [(args) => args.value?.toLowerCase()],
		afterChange: [],
		afterRead: [],
	},
});
```

Field hook signature:

```typescript
(args: {
	value: unknown;
	data: Record<string, unknown>;
	req: unknown;
	operation: 'create' | 'update' | 'read';
}) => unknown | Promise<unknown>;
```

## Related

- [Access Control](access-control.md) — Control who can trigger hooks
- [Custom Endpoints](custom-endpoints.md) — For more complex server logic
