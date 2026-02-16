# OpenTelemetry Plugin

Add distributed tracing to collection operations using the OpenTelemetry API.

## Setup

```bash
npm install @opentelemetry/api
```

```typescript
import { otelPlugin } from '@momentum-cms/plugins/otel';

export default defineMomentumConfig({
	plugins: [
		otelPlugin({
			serviceName: 'my-cms',
			enrichLogs: true,
		}),
	],
});
```

## Configuration

| Option        | Type                     | Default          | Description                                                             |
| ------------- | ------------------------ | ---------------- | ----------------------------------------------------------------------- |
| `serviceName` | `string`                 | `'momentum-cms'` | Service name for spans                                                  |
| `enrichLogs`  | `boolean`                | `true`           | Add trace/span IDs to log entries                                       |
| `attributes`  | `Record<string, string>` | —                | Custom span attributes                                                  |
| `operations`  | `string[]`               | all              | Filter which operations to trace (`create`, `update`, `delete`, `find`) |

## How It Works

The plugin injects before/after hooks into all collection operations. Each operation creates an OpenTelemetry span:

```
posts.create     → Span with collection + operation attributes
posts.find       → Span with timing data
users.update     → Span with document ID
```

### Span Attributes

| Attribute             | Description                                   |
| --------------------- | --------------------------------------------- |
| `momentum.collection` | Collection slug                               |
| `momentum.operation`  | Operation type (create, update, delete, find) |
| `momentum.documentId` | Document ID (when available)                  |
| Custom attributes     | From `attributes` config                      |

### Log Enrichment

When `enrichLogs: true`, trace and span IDs are added to all log entries via a `LogEnricher`, enabling log-trace correlation:

```json
{
	"level": "info",
	"message": "Post created",
	"traceId": "abc123...",
	"spanId": "def456..."
}
```

## Operation Filtering

Only trace specific operations:

```typescript
otelPlugin({
	operations: ['create', 'update', 'delete'], // Skip find/read operations
});
```

## OTel SDK Setup

The plugin uses the OpenTelemetry API only. You must configure the OTel SDK separately in your application. The plugin will automatically use whatever SDK provider is configured.

## Related

- [Plugins Overview](overview.md) — Plugin system
- [Analytics Plugin](analytics.md) — Event tracking
- [Logger](../logger/overview.md) — Log enrichment integration
