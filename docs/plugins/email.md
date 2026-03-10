# Email Plugin

Visual email template editor with block-based builder and auth integration.

## Setup

```bash
npm install @momentumcms/plugins-email
```

```typescript
import { emailPlugin } from '@momentumcms/plugins-email';

export default defineMomentumConfig({
	plugins: [emailPlugin({})],
});
```

## Configuration

| Option    | Type      | Default | Description           |
| --------- | --------- | ------- | --------------------- |
| `enabled` | `boolean` | `true`  | Enable/disable plugin |

## Collection

The plugin creates an `email-templates` collection:

| Field         | Type     | Required | Description                              |
| ------------- | -------- | -------- | ---------------------------------------- |
| `name`        | text     | yes      | Template display name                    |
| `slug`        | text     | yes      | Unique system identifier                 |
| `subject`     | text     | yes      | Email subject (supports `{{variables}}`) |
| `emailBlocks` | json     | no       | Block array for visual builder           |
| `isSystem`    | checkbox | no       | Marks seeded system templates            |

System templates cannot be deleted or have their slug changed.

## Seeded Templates

Two system templates are auto-created on startup:

| Template           | Slug             | Purpose             |
| ------------------ | ---------------- | ------------------- |
| Password Reset     | `password-reset` | Auth password reset |
| Email Verification | `verification`   | Auth email verify   |

## Auth Integration

Connect email templates to the auth system:

```typescript
import { emailPlugin, createFindEmailTemplate } from '@momentumcms/plugins-email';

const email = emailPlugin({});
const auth = momentumAuth({
	email: {
		findEmailTemplate: createFindEmailTemplate(email),
	},
});
```

This allows auth to look up templates by slug for password reset and verification emails.

## Admin UI

The plugin adds an **Email Builder** page to the admin sidebar under the **Tools** group. The visual block editor allows drag-and-drop email template design.

## Related

- [Plugins Overview](overview.md) — Plugin system
