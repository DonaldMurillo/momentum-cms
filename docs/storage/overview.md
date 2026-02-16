# Storage

Momentum CMS uses a storage adapter pattern for file uploads. Choose between local filesystem or S3-compatible storage.

## Package

```bash
npm install @momentumcms/storage
```

## Configuration

```typescript
import { defineMomentumConfig } from '@momentumcms/core';
import { localStorageAdapter } from '@momentumcms/storage';

export default defineMomentumConfig({
	storage: {
		adapter: localStorageAdapter({ directory: './uploads' }),
		maxFileSize: 10 * 1024 * 1024, // 10MB (default)
		allowedMimeTypes: ['image/*', 'application/pdf', 'video/*', 'audio/*'],
	},
	// ...
});
```

## StorageAdapter Interface

All adapters implement:

```typescript
interface StorageAdapter {
	upload(file: UploadedFile, options?: UploadOptions): Promise<StoredFile>;
	delete(path: string): Promise<boolean>;
	getUrl(path: string): string;
	exists(path: string): Promise<boolean>;

	// Optional
	getSignedUrl?(path: string, expiresIn?: number): Promise<string>;
	read?(path: string): Promise<Buffer | null>;
}
```

### Types

```typescript
interface UploadedFile {
	originalName: string;
	mimeType: string;
	size: number;
	buffer: Buffer;
}

interface StoredFile {
	path: string;
	url: string;
	filename: string;
	mimeType: string;
	size: number;
}

interface UploadOptions {
	filename?: string; // Custom filename (without extension)
	directory?: string; // Subdirectory within uploads
}
```

## Upload Validation

Uploads go through a validation pipeline:

1. **Authentication** — User must be logged in
2. **File size** — Checked against `maxFileSize`
3. **MIME type pattern** — Checked against `allowedMimeTypes` (supports globs like `image/*`)
4. **Magic bytes** — Actual file type detected from binary signature and compared to claimed type

## MIME Type Utilities

```typescript
import { validateMimeType, isMimeTypeAllowed, detectMimeType } from '@momentumcms/storage';

// Detect type from file contents
const detected = detectMimeType(buffer); // 'image/png'

// Check against allowed patterns
isMimeTypeAllowed('image/png', ['image/*']); // true

// Full validation
const result = validateMimeType(buffer, 'image/png', ['image/*']);
// { valid: true, detectedType: 'image/png', claimedType: 'image/png' }
```

## Media Collection

Momentum auto-creates a `media` collection for uploaded files:

```typescript
interface MediaDocument {
	id: string;
	filename: string;
	mimeType: string;
	filesize?: number;
	path: string;
	url?: string;
	alt?: string;
	width?: number;
	height?: number;
	focalPoint?: { x: number; y: number };
	createdAt: string;
	updatedAt: string;
}
```

Default access: read is public, create/update/delete require authentication.

## Available Adapters

| Adapter           | Use Case                                  |
| ----------------- | ----------------------------------------- |
| [Local](local.md) | Development, single-server deployments    |
| [S3](s3.md)       | Production, multi-server, CDN integration |

## Related

- [Local Adapter](local.md) — Filesystem storage
- [S3 Adapter](s3.md) — S3-compatible storage
- [REST API](../server/rest-api.md) — Media upload endpoints
