# Plugins

Momentum CMS has a plugin system for extending functionality with lifecycle hooks, middleware, event subscriptions, and admin UI routes.

## Package

```bash
npm install @momentum-cms/plugins
```

## MomentumPlugin Interface

```typescript
interface MomentumPlugin {
	name: string;
	collections?: CollectionConfig[];
	adminRoutes?: PluginAdminRouteDescriptor[];
	modifyCollections?(collections: CollectionConfig[]): void;
	onInit?(context: PluginContext): void | Promise<void>;
	onReady?(context: PluginReadyContext): void | Promise<void>;
	onShutdown?(context: PluginContext): void | Promise<void>;
}
```

## Lifecycle

Plugins execute in this order during startup:

1. **`modifyCollections(collections)`** — Transform collection configs at setup time (must be idempotent)
2. **`onInit(context)`** — Before API initialization; inject hooks, register middleware/providers
3. **`onReady(context)`** — After API and seeding complete; API fully available
4. **`onShutdown(context)`** — Graceful shutdown; cleanup resources

Init and Ready run in array order. Shutdown runs in reverse order.

## Plugin Context

```typescript
interface PluginContext {
	config: MomentumConfig;
	collections: CollectionConfig[];
	logger: PluginLogger;
	registerMiddleware(descriptor: PluginMiddlewareDescriptor): void;
	registerProvider(descriptor: PluginProviderDescriptor): void;
}

interface PluginReadyContext extends PluginContext {
	api: MomentumAPI; // Fully initialized
}
```

## Registration

Add plugins to your Momentum config:

```typescript
import { defineMomentumConfig } from '@momentum-cms/core';
import { analyticsPlugin } from '@momentum-cms/plugins/analytics';
import { otelPlugin } from '@momentum-cms/plugins/otel';

export default defineMomentumConfig({
	plugins: [
		analyticsPlugin({
			/* ... */
		}),
		otelPlugin({ serviceName: 'my-cms' }),
	],
});
```

## Event Bus

The event bus provides pub/sub for collection events:

```typescript
import { eventBusPlugin } from '@momentum-cms/plugins/core';

const events = eventBusPlugin();

export default defineMomentumConfig({
	plugins: [events],
});

// Subscribe to events
events.bus.on('posts:afterChange', (event) => {
	console.warn('Post changed:', event.doc);
});
```

### Event Patterns

| Pattern               | Matches                        |
| --------------------- | ------------------------------ |
| `"posts:afterChange"` | Specific collection + event    |
| `"*:afterDelete"`     | Any collection, specific event |
| `"posts:*"`           | Specific collection, any event |
| `"*"`                 | All events                     |

### Event Types

```typescript
type CollectionEventType =
	| 'beforeChange'
	| 'afterChange'
	| 'beforeDelete'
	| 'afterDelete'
	| 'beforeRead'
	| 'afterRead';

interface CollectionEvent {
	collection: string;
	event: CollectionEventType;
	operation?: 'create' | 'update' | 'delete' | 'softDelete' | 'restore';
	doc?: Record<string, unknown>;
	previousDoc?: Record<string, unknown>;
	timestamp: string;
}
```

## Plugin Middleware

Register Express routes or middleware:

```typescript
context.registerMiddleware({
	path: '/my-endpoint',
	handler: myExpressRouter,
	position: 'before-api', // or 'after-api'
});
```

## Plugin Admin Routes

Add pages to the admin sidebar:

```typescript
const myPlugin: MomentumPlugin = {
	name: 'my-plugin',
	adminRoutes: [
		{
			path: 'my-page',
			loadComponent: () => import('./my-page.component'),
			label: 'My Page',
			icon: 'heroChartBarSquare',
			group: 'Tools',
		},
	],
};
```

## Error Handling

- Non-fatal errors are logged and skipped
- Throw `PluginFatalError` to halt server startup:

```typescript
import { PluginFatalError } from '@momentum-cms/plugins/core';

throw new PluginFatalError('my-plugin', 'Required service unavailable');
```

## Available Plugins

| Plugin                            | Description                                    |
| --------------------------------- | ---------------------------------------------- |
| [Analytics](analytics.md)         | Tracking, content performance, block analytics |
| [OpenTelemetry](opentelemetry.md) | Distributed tracing                            |

## Related

- [Writing a Plugin](writing-a-plugin.md) — Step-by-step guide
- [Analytics Plugin](analytics.md) — Built-in analytics
- [OpenTelemetry Plugin](opentelemetry.md) — Tracing integration
