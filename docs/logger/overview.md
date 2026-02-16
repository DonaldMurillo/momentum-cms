# Logger

Momentum CMS includes a structured logging library with hierarchical contexts, multiple formatters, and extensible enrichers.

## Package

```bash
npm install @momentum-cms/logger
```

## Quick Start

```typescript
import { initializeMomentumLogger, createLogger } from '@momentum-cms/logger';

// Initialize at startup (once)
initializeMomentumLogger({ level: 'debug', format: 'pretty' });

// Create child loggers in your code
const logger = createLogger('MyService');
logger.info('Service started'); // [Momentum:MyService] Service started
logger.debug('Details', { port: 3000 }); // [Momentum:MyService] Details port=3000
```

## Configuration

```typescript
interface LoggingConfig {
	level?: LogLevel; // Default: 'info'
	format?: 'pretty' | 'json'; // Default: 'pretty'
	timestamps?: boolean; // Default: true
	output?: (msg: string) => void; // Default: process.stdout.write
	errorOutput?: (msg: string) => void; // Default: process.stderr.write
}
```

## Log Levels

| Level    | Value | Output | Description          |
| -------- | ----- | ------ | -------------------- |
| `debug`  | 0     | stdout | Verbose debugging    |
| `info`   | 1     | stdout | Normal operations    |
| `warn`   | 2     | stderr | Potential issues     |
| `error`  | 3     | stderr | Errors               |
| `fatal`  | 4     | stderr | Unrecoverable errors |
| `silent` | 5     | —      | No output            |

Messages are logged when their level >= the configured level.

## Logger Methods

```typescript
logger.debug(message, data?)
logger.info(message, data?)
logger.warn(message, data?)
logger.error(message, data?)
logger.fatal(message, data?)
```

The optional `data` parameter accepts `Record<string, unknown>` for structured context.

## Child Loggers

Create hierarchical contexts with colon-separated namespaces:

```typescript
const dbLogger = createLogger('DB'); // Momentum:DB
const migrate = dbLogger.child('Migrate'); // Momentum:DB:Migrate
const seed = dbLogger.child('Seed'); // Momentum:DB:Seed
```

## Formatters

### Pretty (default)

Human-readable with ANSI colors:

```
2026-02-15 10:23:45.123  INFO  [Momentum:DB] Connected successfully
2026-02-15 10:23:45.456  WARN  [Momentum:Auth] Session expired userId=abc123
```

Color coding:

- `debug` — dim gray
- `info` — cyan
- `warn` — yellow
- `error` — red
- `fatal` — bold white on red background

Colors respect `FORCE_COLOR`, `NO_COLOR`, and `TERM=dumb` environment variables.

### JSON

Structured JSON for log aggregation:

```json
{
	"timestamp": "2026-02-15T10:23:45.123Z",
	"level": "info",
	"context": "Momentum:DB",
	"message": "Connected successfully"
}
```

Enrichments are merged at the top level, data goes under a `data` key.

## Enrichers

Add contextual data to every log entry:

```typescript
import { MomentumLogger, type LogEnricher } from '@momentum-cms/logger';

class RequestIdEnricher implements LogEnricher {
	enrich(): Record<string, unknown> {
		return { requestId: getCurrentRequestId() };
	}
}

// Register globally
MomentumLogger.registerEnricher(new RequestIdEnricher());

// Later, remove if needed
MomentumLogger.removeEnricher(enricher);
MomentumLogger.clearEnrichers();
```

Enrichments appear in pretty format as `key=value` pairs and in JSON format as top-level fields.

### OpenTelemetry Enricher

The [OTel plugin](../plugins/opentelemetry.md) automatically registers an enricher that adds `traceId` and `spanId` to log entries.

## Singleton Management

| Function                            | Description                                               |
| ----------------------------------- | --------------------------------------------------------- |
| `initializeMomentumLogger(config?)` | Initialize root logger (call once at startup)             |
| `getMomentumLogger()`               | Get root logger (auto-creates default if not initialized) |
| `createLogger(context)`             | Create child logger (primary API)                         |
| `resetMomentumLogger()`             | Reset singleton (testing only)                            |

## Zero Dependencies

The logger has no external dependencies. ANSI color codes are implemented directly.

## Related

- [OpenTelemetry Plugin](../plugins/opentelemetry.md) — Trace/span enrichment
- [Server Overview](../server/overview.md) — Server architecture
