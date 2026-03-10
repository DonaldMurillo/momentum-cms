# Redirects Plugin

URL redirect management with caching and multiple redirect types.

## Setup

```bash
npm install @momentumcms/plugins-redirects
```

```typescript
import { redirectsPlugin } from '@momentumcms/plugins-redirects';

export default defineMomentumConfig({
	plugins: [redirectsPlugin({})],
});
```

## Configuration

| Option     | Type      | Default | Description                     |
| ---------- | --------- | ------- | ------------------------------- |
| `enabled`  | `boolean` | `true`  | Enable/disable plugin           |
| `cacheTtl` | `number`  | `60000` | Cache duration (ms, default 1m) |

## Collection

The plugin creates a `redirects` collection:

| Field    | Type     | Required | Default       | Description                       |
| -------- | -------- | -------- | ------------- | --------------------------------- |
| `from`   | text     | yes      | —             | Source path (must start with `/`) |
| `to`     | text     | yes      | —             | Destination URL or path           |
| `type`   | select   | no       | `'permanent'` | Redirect type                     |
| `active` | checkbox | no       | `true`        | Enable/disable redirect           |

### Redirect Types

| Type                 | Status | Behavior              |
| -------------------- | ------ | --------------------- |
| `permanent`          | 301    | Standard permanent    |
| `temporary`          | 302    | Standard temporary    |
| `temporary_preserve` | 307    | Preserves HTTP method |
| `permanent_preserve` | 308    | Preserves HTTP method |

## How It Works

1. The plugin registers root-level Express middleware (before Angular SSR)
2. On each request, it checks the path against active redirects
3. Results are cached for `cacheTtl` milliseconds
4. Matching requests are redirected with the configured status code

### Validation

- `from` must start with `/`, no query strings or fragments
- `to` cannot use `javascript:`, `data:`, or `vbscript:` schemes
- `to` cannot be protocol-relative (`//example.com`)
- `from` and `to` must differ (prevents redirect loops)

## Access Control

- **Read**: public
- **Create/Update/Delete**: admin only

## Related

- [Plugins Overview](overview.md) — Plugin system
