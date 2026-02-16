# Webhooks

Send HTTP notifications when collection events occur.

## Configuration

```typescript
export const Posts = defineCollection({
	slug: 'posts',
	webhooks: [
		{
			url: 'https://example.com/webhooks/posts',
			events: ['afterCreate', 'afterUpdate', 'afterDelete'],
			secret: process.env['WEBHOOK_SECRET'],
			retries: 3,
			headers: {
				'X-Source': 'momentum-cms',
			},
		},
	],
	fields: [],
});
```

## Webhook Events

| Event         | Trigger              |
| ------------- | -------------------- |
| `afterChange` | Any create or update |
| `afterCreate` | Document created     |
| `afterUpdate` | Document updated     |
| `afterDelete` | Document deleted     |

## Payload

Webhooks send a POST request with this JSON body:

```typescript
interface WebhookPayload {
	event: 'afterChange' | 'afterDelete' | 'afterCreate' | 'afterUpdate';
	collection: string;
	operation: 'create' | 'update' | 'delete' | 'softDelete' | 'restore';
	timestamp: string; // ISO 8601
	doc: Record<string, unknown>;
	previousDoc?: Record<string, unknown>; // For updates
}
```

## HMAC Signature Verification

When a `secret` is configured, requests include an `X-Momentum-Signature` header with an HMAC-SHA256 signature of the payload.

### Verify on the Receiving End

```typescript
import { createHmac } from 'crypto';

function verifyWebhook(body: string, signature: string, secret: string): boolean {
	const expected = createHmac('sha256', secret).update(body).digest('hex');
	return signature === expected;
}
```

## Options

| Option    | Type                     | Default    | Description                       |
| --------- | ------------------------ | ---------- | --------------------------------- |
| `url`     | `string`                 | —          | Endpoint URL (required)           |
| `events`  | `WebhookEvent[]`         | All events | Which events trigger this webhook |
| `secret`  | `string`                 | —          | HMAC-SHA256 signing secret        |
| `retries` | `number`                 | `0`        | Max retries on failure            |
| `headers` | `Record<string, string>` | —          | Custom headers                    |

## Related

- [Hooks](hooks.md) — Server-side lifecycle hooks
- [Custom Endpoints](custom-endpoints.md) — Receive webhooks
