# API Keys

Programmatic access to Momentum CMS via API keys.

## Overview

API keys allow machine-to-machine access without user sessions. They can be scoped to specific collections and operations.

## Creating API Keys

API keys are managed through the admin dashboard or the auth API:

```bash
POST /api/auth/api-keys
Content-Type: application/json

{
  "name": "CI Pipeline",
  "scopes": ["posts:read", "posts:create"]
}
```

## Using API Keys

Include the API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer mcms_your_api_key_here" \
  http://localhost:4200/api/posts
```

## Scoping

API keys can be scoped to specific operations:

| Scope          | Description     |
| -------------- | --------------- |
| `posts:read`   | Read posts only |
| `posts:create` | Create posts    |
| `posts:update` | Update posts    |
| `posts:delete` | Delete posts    |
| `*`            | Full access     |

## Security Considerations

- Store API keys securely (environment variables, secrets manager)
- Use the narrowest scope needed
- Rotate keys periodically
- Revoke compromised keys immediately

## Related

- [Overview](overview.md) — Auth architecture
- [REST API](../server/rest-api.md) — API endpoints
