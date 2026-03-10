# Form Builder Plugin

Dynamic form creation with schema-based validation, conditional fields, honeypot protection, and webhook notifications.

## Setup

```bash
npm install @momentumcms/plugins-form-builder
```

```typescript
import { formBuilderPlugin } from '@momentumcms/plugins-form-builder';

export default defineMomentumConfig({
	plugins: [formBuilderPlugin({})],
});
```

## Configuration

| Option               | Type      | Default | Description                       |
| -------------------- | --------- | ------- | --------------------------------- |
| `honeypot`           | `boolean` | `true`  | Enable honeypot anti-spam field   |
| `rateLimitPerMinute` | `number`  | `10`    | Max submissions per IP per minute |

## Collections

### Forms

Stores form definitions with JSON schema:

| Field             | Type     | Required | Default                            | Description                      |
| ----------------- | -------- | -------- | ---------------------------------- | -------------------------------- |
| `title`           | text     | yes      | —                                  | Form display name                |
| `slug`            | text     | yes      | —                                  | URL-friendly identifier          |
| `status`          | select   | no       | `'draft'`                          | `draft`, `published`, `archived` |
| `schema`          | json     | yes      | —                                  | Form field definitions           |
| `description`     | text     | no       | —                                  | Form description                 |
| `successMessage`  | text     | no       | `'Thank you for your submission!'` | Post-submit message              |
| `redirectUrl`     | text     | no       | —                                  | Post-submit redirect URL         |
| `honeypot`        | checkbox | no       | `true`                             | Per-form honeypot toggle         |
| `webhooks`        | json     | no       | `[]`                               | Webhook configurations           |
| `submissionCount` | number   | no       | `0`                                | Auto-incremented counter         |

Admin-only access. Group: **Content**.

### Form Submissions

| Field       | Type | Required | Description                     |
| ----------- | ---- | -------- | ------------------------------- |
| `formId`    | text | yes      | Reference to parent form        |
| `formSlug`  | text | yes      | Denormalized form slug          |
| `formTitle` | text | no       | Denormalized form title         |
| `data`      | json | yes      | Sanitized submission data       |
| `metadata`  | json | no       | IP, user agent, submission time |

Admin read/update/delete only. Public create (via submit endpoint). Group: **Content**.

## Public API

### Get Form Schema

```
GET /forms/:idOrSlug/schema
```

Returns the form schema for client-side rendering. Only published forms are accessible.

### Validate Form Data

```
POST /forms/:idOrSlug/validate
Content-Type: application/json

{ "fieldName": "value" }
```

Returns `{ valid: boolean, errors: ValidationError[] }`.

### Submit Form

```
POST /forms/:idOrSlug/submit
Content-Type: application/json

{ "fieldName": "value" }
```

Pipeline:

1. Honeypot check (silently rejects bots with 200)
2. Rate limit check
3. Two-pass validation (handles conditional field chains)
4. Data sanitization (only schema-defined fields stored)
5. Save submission and increment counter
6. Dispatch webhooks (fire-and-forget)

Returns `{ success: boolean, message: string, redirectUrl?: string }`.

## Conditional Fields

Fields can depend on other fields:

```json
{
	"name": "shippingAddress",
	"type": "textarea",
	"required": true,
	"conditions": [{ "field": "needsShipping", "operator": "equals", "value": true }]
}
```

Multi-level chains are supported (A controls B, B controls C). Hidden fields are excluded from validation.

## Webhooks

```typescript
{
	webhooks: [
		{
			url: 'https://hooks.example.com/form',
			secret: 'my-hmac-secret',  // Optional HMAC-SHA256 signing
			headers: { 'X-Custom': 'value' },
		},
	],
}
```

When a secret is provided, the payload is signed with HMAC-SHA256 and sent in the `X-Momentum-Signature` header. Webhooks retry up to 3 times with exponential backoff.

## Related

- [Plugins Overview](overview.md) — Plugin system
