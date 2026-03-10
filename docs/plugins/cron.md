# Cron Plugin

Recurring job scheduler with persistent schedules, 5-field cron expressions, and distributed-safe deduplication.

## Setup

```bash
npm install @momentumcms/plugins-cron @momentumcms/plugins-queue
```

```typescript
import { queuePlugin, MemoryQueueAdapter } from '@momentumcms/plugins-queue';
import { cronPlugin } from '@momentumcms/plugins-cron';

const queue = queuePlugin({
	adapter: new MemoryQueueAdapter(),
	handlers: {
		'cleanup:old-sessions': async (payload, job, { api }) => {
			// Clean up expired sessions
		},
	},
});

const cron = cronPlugin({
	queue,
	schedules: [
		{
			name: 'cleanup-sessions',
			type: 'cleanup:old-sessions',
			cron: '0 3 * * *', // Daily at 3 AM
		},
	],
});

export default defineMomentumConfig({
	plugins: [queue, cron],
});
```

## Configuration

| Option           | Type                       | Default  | Description                        |
| ---------------- | -------------------------- | -------- | ---------------------------------- |
| `queue`          | `QueuePluginInstance`      | required | Queue plugin instance              |
| `schedules`      | `RecurringJobDefinition[]` | `[]`     | Static schedules synced on startup |
| `checkInterval`  | `number`                   | `60000`  | Check interval for due jobs (ms)   |
| `adminDashboard` | `boolean`                  | `true`   | Enable admin routes                |

## Schedule Definition

```typescript
interface RecurringJobDefinition {
	name: string; // Unique schedule name
	type: string; // Job type to enqueue
	cron: string; // 5-field cron expression
	payload?: unknown; // Job payload
	queue?: string; // Queue name (default: 'default')
	priority?: number; // 0-9 (default: 5)
	maxRetries?: number; // Default: 3
	timeout?: number; // Default: 30000
}
```

## Cron Expression Format

Standard 5-field format: `minute hour day-of-month month day-of-week`

| Field        | Range | Special Characters |
| ------------ | ----- | ------------------ |
| Minute       | 0-59  | `*`, `,`, `-`, `/` |
| Hour         | 0-23  | `*`, `,`, `-`, `/` |
| Day of Month | 1-31  | `*`, `,`, `-`, `/` |
| Month        | 1-12  | `*`, `,`, `-`, `/` |
| Day of Week  | 0-7   | `*`, `,`, `-`, `/` |

Both 0 and 7 represent Sunday. When both day-of-month and day-of-week are specified (not `*`), a date matches if **either** field matches (Vixie cron semantics).

### Examples

| Expression       | Schedule                      |
| ---------------- | ----------------------------- |
| `* * * * *`      | Every minute                  |
| `0 * * * *`      | Every hour                    |
| `0 3 * * *`      | Daily at 3:00 AM              |
| `0 0 * * 1`      | Every Monday at midnight      |
| `*/15 * * * *`   | Every 15 minutes              |
| `0 9-17 * * 1-5` | Hourly, 9 AM - 5 PM, weekdays |

## Programmatic API

```typescript
// Add or update a schedule
await cron.addSchedule({
	name: 'daily-report',
	type: 'report:generate',
	cron: '0 8 * * *',
	payload: { format: 'pdf' },
});

// Remove a schedule
await cron.removeSchedule('daily-report');

// List all schedules
const schedules = await cron.getSchedules();
```

## How It Works

1. On startup, static schedules from config are synced to the `cron-schedules` collection (upsert by name)
2. Every `checkInterval` ms, the plugin queries for enabled schedules where `nextRunAt <= now`
3. For each due schedule, it advances `nextRunAt` **before** enqueueing (fail-safe)
4. Jobs are enqueued with a deduplication key (`cron:{name}:{nextRunAt}`) to prevent duplicates in distributed deployments
5. The queue plugin processes the enqueued jobs using registered handlers

## Collection

The plugin creates a `cron-schedules` collection with admin-only access. Fields include `name`, `type`, `cron`, `payload`, `queue`, `priority`, `enabled`, `lastRunAt`, and `nextRunAt`.

## Related

- [Plugins Overview](overview.md) — Plugin system
- [Queue Plugin](queue.md) — Job queue (required dependency)
