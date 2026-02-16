# Writing a Plugin

Create custom plugins to extend Momentum CMS with new collections, hooks, middleware, and admin pages.

## Basic Structure

```typescript
import { MomentumPlugin } from '@momentum-cms/core';

export function myPlugin(config: MyPluginConfig): MomentumPlugin {
	return {
		name: 'my-plugin',

		// Optional: add collections
		collections: [],

		// Optional: add admin pages
		adminRoutes: [],

		// Optional: modify existing collections
		modifyCollections(collections) {
			// Must be idempotent (called multiple times)
		},

		// Optional: before API init
		async onInit(context) {
			context.logger.info('Initializing...');
		},

		// Optional: after API ready
		async onReady(context) {
			const { api } = context;
			// Full API access here
		},

		// Optional: graceful shutdown
		async onShutdown(context) {
			// Cleanup resources
		},
	};
}
```

## Adding Collections

Plugins can contribute their own collections:

```typescript
import { defineCollection, text, number } from '@momentum-cms/core';

const AuditLog = defineCollection({
	slug: 'audit-logs',
	fields: [text('action', { required: true }), text('userId'), text('details')],
	access: {
		read: hasRole('admin'),
		create: denyAll,
		update: denyAll,
		delete: denyAll,
	},
});

export function auditPlugin(): MomentumPlugin {
	return {
		name: 'audit',
		collections: [AuditLog],
	};
}
```

## Injecting Hooks

Use `modifyCollections` to add hooks to existing collections:

```typescript
export function timestampPlugin(): MomentumPlugin {
	return {
		name: 'timestamp',

		modifyCollections(collections) {
			for (const collection of collections) {
				const existingBeforeChange = collection.hooks?.beforeChange;

				collection.hooks = {
					...collection.hooks,
					beforeChange: [
						...(Array.isArray(existingBeforeChange) ? existingBeforeChange : []),
						async ({ data, operation }) => {
							if (operation === 'create') {
								data.createdAt = new Date().toISOString();
							}
							data.updatedAt = new Date().toISOString();
							return data;
						},
					],
				};
			}
		},
	};
}
```

## Registering Middleware

Add Express routes or middleware during `onInit`:

```typescript
import { Router } from 'express';

export function healthPlugin(): MomentumPlugin {
	return {
		name: 'health',

		onInit(context) {
			const router = Router();
			router.get('/health', (req, res) => {
				res.json({ status: 'ok', timestamp: new Date().toISOString() });
			});

			context.registerMiddleware({
				path: '/health',
				handler: router,
				position: 'before-api',
			});
		},
	};
}
```

## Adding Admin Pages

Register lazy-loaded Angular components in the admin sidebar:

```typescript
export function dashboardPlugin(): MomentumPlugin {
	return {
		name: 'dashboard',
		adminRoutes: [
			{
				path: 'reports',
				loadComponent: () => import('./reports-page.component'),
				label: 'Reports',
				icon: 'heroChartBarSquare',
				group: 'Analytics',
			},
		],
	};
}
```

## Using the API in onReady

The `onReady` lifecycle has full API access:

```typescript
async onReady(context) {
  const { api, logger } = context;

  // Query collections
  const users = await api.find('users', { limit: 100 });
  logger.info(`Found ${users.totalDocs} users`);

  // Create documents
  await api.create('notifications', {
    message: 'System started',
    type: 'info',
  });
}
```

## Error Handling

- Return or throw normally for non-fatal errors (logged and skipped)
- Throw `PluginFatalError` to halt server startup:

```typescript
import { PluginFatalError } from '@momentum-cms/plugins/core';

async onInit(context) {
  const isAvailable = await checkExternalService();
  if (!isAvailable) {
    throw new PluginFatalError('my-plugin', 'External service unavailable');
  }
}
```

## Registering Angular Providers

Inject Angular providers for SSR:

```typescript
onInit(context) {
  context.registerProvider({
    name: 'my-service',
    token: MY_SERVICE_TOKEN,
    value: new MyService(context.config),
  });
}
```

## Related

- [Plugins Overview](overview.md) — Plugin interface reference
- [Analytics Plugin](analytics.md) — Example of a full plugin
- [Hooks](../collections/hooks.md) — Collection lifecycle hooks
