# Queue Plugin

Job queue with priority scheduling, retry with backoff, deduplication, and admin dashboard.

## Setup

```bash
npm install @momentumcms/plugins-queue
```

```typescript
import { queuePlugin, MemoryQueueAdapter } from '@momentumcms/plugins-queue';

const queue = queuePlugin({
	adapter: new MemoryQueueAdapter(),
	handlers: {
		'email:send': async (payload, job, { logger, api }) => {
			logger.info(`Sending email to ${payload.to}`);
		},
	},
});

export default defineMomentumConfig({
	plugins: [queue],
});
```

## Configuration

| Option                 | Type                           | Default           | Description                        |
| ---------------------- | ------------------------------ | ----------------- | ---------------------------------- |
| `adapter`              | `QueueAdapter`                 | required          | Queue backend (memory or pg)       |
| `handlers`             | `Record<string, JobHandler>`   | `{}`              | Job handlers keyed by type name    |
| `workers`              | `Record<string, WorkerConfig>` | `{ default: {} }` | Worker config per queue            |
| `stalledCheckInterval` | `number`                       | `30000`           | Stalled job check interval (ms)    |
| `purgeInterval`        | `number`                       | `3600000`         | Purge old jobs interval (ms)       |
| `purgeAge`             | `number`                       | `604800000`       | Age threshold for purging (7 days) |
| `adminDashboard`       | `boolean`                      | `true`            | Enable admin API routes            |

### Worker Config

| Option         | Type      | Default | Description                  |
| -------------- | --------- | ------- | ---------------------------- |
| `concurrency`  | `number`  | `1`     | Jobs to process concurrently |
| `pollInterval` | `number`  | `1000`  | Polling interval (ms)        |
| `enabled`      | `boolean` | `true`  | Whether to start the worker  |

## Adapters

### MemoryQueueAdapter

In-memory adapter for development and testing. No persistence across restarts.

```typescript
import { MemoryQueueAdapter } from '@momentumcms/plugins-queue';

const queue = queuePlugin({
	adapter: new MemoryQueueAdapter(),
	handlers: {},
});
```

### PostgreSQL Adapter

Production adapter using `SKIP LOCKED` for atomic job claiming.

```typescript
import { postgresQueueAdapter } from '@momentumcms/queue';

const queue = queuePlugin({
	adapter: postgresQueueAdapter({ pool }),
	handlers: {},
});
```

## Enqueueing Jobs

```typescript
const job = await queue.enqueue(
	'email:send',
	{ to: 'user@example.com' },
	{
		queue: 'emails',
		priority: 0, // 0-9, lower = higher priority
		timeout: 60000,
		uniqueKey: 'welcome-email-123', // Deduplication
		maxRetries: 5,
		backoff: { type: 'exponential', delay: 1000 },
		runAt: new Date('2025-01-01'), // Delayed execution
		metadata: { source: 'signup' },
	},
);
```

### Enqueue Options

| Option       | Type              | Default                                | Description             |
| ------------ | ----------------- | -------------------------------------- | ----------------------- |
| `queue`      | `string`          | `'default'`                            | Queue name              |
| `priority`   | `0-9`             | `5`                                    | Lower = higher priority |
| `runAt`      | `string \| Date`  | —                                      | Delay until this time   |
| `maxRetries` | `number`          | `3`                                    | Max retry attempts      |
| `backoff`    | `BackoffStrategy` | `{ type: 'exponential', delay: 1000 }` | Retry backoff strategy  |
| `timeout`    | `number`          | `30000`                                | Job timeout (ms)        |
| `uniqueKey`  | `string`          | —                                      | Deduplication key       |
| `metadata`   | `object`          | —                                      | Arbitrary metadata      |

## Job Handlers

```typescript
import type { JobHandler } from '@momentumcms/plugins-queue';

const sendEmail: JobHandler<{ to: string; subject: string }> = async (
	payload,
	job,
	{ api, logger, enqueue, signal },
) => {
	logger.info(`Processing job ${job.id}`);

	// Access database
	const user = await api.findById('users', payload.userId);

	// Chain another job
	await enqueue('audit:log', { action: 'email-sent', to: payload.to });

	// Respect abort signal for long-running jobs
	if (signal.aborted) return;
};
```

## Job Lifecycle

```
pending → active → completed
              ↓
           failed → pending (retry with backoff)
              ↓
            dead (max retries exceeded)
```

### Backoff Strategies

| Type          | Formula                                |
| ------------- | -------------------------------------- |
| `exponential` | `min(delay * 2^(attempt-1), maxDelay)` |
| `linear`      | `min(delay * attempt, maxDelay)`       |
| `fixed`       | `delay`                                |

Default `maxDelay` is 300,000ms (5 minutes).

## Admin API

All endpoints require admin authentication.

| Method   | Endpoint                | Description      |
| -------- | ----------------------- | ---------------- |
| `GET`    | `/queue/stats`          | Queue statistics |
| `GET`    | `/queue/jobs`           | List/filter jobs |
| `GET`    | `/queue/jobs/:id`       | Get job details  |
| `POST`   | `/queue/jobs/:id/retry` | Retry dead job   |
| `DELETE` | `/queue/jobs/:id`       | Delete job       |
| `POST`   | `/queue/purge`          | Purge old jobs   |

## Collection

The plugin creates a `queue-jobs` collection (admin-only, read/delete access). Jobs are managed through the adapter, not CRUD operations.

## Related

- [Plugins Overview](overview.md) — Plugin system
- [Cron Plugin](cron.md) — Recurring job scheduling
