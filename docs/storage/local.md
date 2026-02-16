# Local Storage Adapter

Store uploads on the local filesystem. Best for development and single-server deployments.

## Setup

```typescript
import { localStorageAdapter } from '@momentum-cms/storage';

export default defineMomentumConfig({
	storage: {
		adapter: localStorageAdapter({
			directory: './uploads',
			baseUrl: 'http://localhost:4200/uploads',
		}),
	},
});
```

## Options

| Option      | Type     | Default  | Description                                               |
| ----------- | -------- | -------- | --------------------------------------------------------- |
| `directory` | `string` | required | Directory for stored files                                |
| `baseUrl`   | `string` | —        | Public URL prefix. Falls back to `/api/media/file/{path}` |

## How It Works

- Files are stored with UUID filenames preserving the original extension
- Directories are auto-created if they don't exist
- Files are served via the `baseUrl` if set, otherwise through the API media endpoint

## Security

The local adapter includes several protections:

- **Directory traversal prevention** — Paths are normalized and bounds-checked
- **Symlink rejection** — Prevents filesystem escape attacks
- **UUID filenames** — Original filenames are not used on disk

## Methods

All `StorageAdapter` methods are implemented, including the optional `read()` method for serving files through the API endpoint.

## Related

- [Storage Overview](overview.md) — Adapter interface
- [S3 Adapter](s3.md) — Cloud storage alternative
