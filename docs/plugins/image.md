# Image Processing Plugin

Automatically generates image size variants on upload, detects dimensions, and supports focal point cropping with an interactive admin UI picker.

## Package

```bash
npm install @momentumcms/plugins-image @napi-rs/image
```

> **Note:** This plugin uses [`@napi-rs/image`](https://github.com/nickel-org/image-napi) (Rust via NAPI-RS) for image processing. It does **not** use Sharp.

## Quick Start

```typescript
import { defineMomentumConfig } from '@momentumcms/core';
import { imagePlugin } from '@momentumcms/plugins/image';

export default defineMomentumConfig({
	plugins: [imagePlugin()],
	// ...
});
```

The plugin automatically hooks into any collection with `upload.imageSizes` configured.

## Configuring Image Sizes

Define size variants on your upload collection:

```typescript
import { defineCollection, text } from '@momentumcms/core';

export const Media = defineCollection({
	slug: 'media',
	upload: {
		imageSizes: [
			{
				name: 'thumbnail',
				width: 150,
				height: 150,
				fit: 'cover',
			},
			{
				name: 'medium',
				width: 800,
				fit: 'width',
			},
			{
				name: 'hero',
				width: 1920,
				height: 1080,
				fit: 'contain',
				format: 'webp',
				quality: 85,
			},
		],
	},
	fields: [text('alt', { label: 'Alt Text' })],
});
```

### ImageSizeConfig

| Property  | Type                                                    | Default       | Description                           |
| --------- | ------------------------------------------------------- | ------------- | ------------------------------------- |
| `name`    | `string`                                                | **required**  | Variant name (used as key in `sizes`) |
| `width`   | `number`                                                | —             | Target width in pixels                |
| `height`  | `number`                                                | —             | Target height in pixels               |
| `fit`     | `'cover' \| 'contain' \| 'fill' \| 'width' \| 'height'` | `'cover'`     | Resize strategy                       |
| `format`  | `'jpeg' \| 'png' \| 'webp' \| 'avif'`                   | source format | Output format                         |
| `quality` | `number`                                                | `80`          | Compression quality (1-100)           |

### Fit Modes

- **`cover`** — Crop to fill exact dimensions, respecting focal point
- **`contain`** — Scale down to fit within dimensions, preserving aspect ratio
- **`fill`** — Stretch to exact dimensions (may distort)
- **`width`** — Scale to target width, auto-calculate height
- **`height`** — Scale to target height, auto-calculate width

## Focal Point

The plugin supports focal point-aware cropping for `cover` fit mode. When a user sets a focal point via the admin UI, the crop region is centered on that point instead of the image center.

The focal point is stored as `{ x: number, y: number }` where both values are `0` to `1` (normalized coordinates). `{ x: 0.5, y: 0.5 }` is the center.

### Admin UI

The focal point picker appears automatically in the admin UI for any upload collection with image files:

- **Create/Edit pages** — Interactive crosshair overlay on the image preview
- **View page** — Read-only focal point indicator
- **Media edit dialog** — Focal point picker with crop preview outlines showing how each configured size variant will crop

## Generated Variants

After upload, generated variants are stored in the document's `sizes` field:

```json
{
	"sizes": {
		"thumbnail": {
			"url": "/api/media/file/media/abc123-thumbnail.jpg",
			"path": "media/abc123-thumbnail.jpg",
			"width": 150,
			"height": 150,
			"mimeType": "image/jpeg",
			"filesize": 8432
		},
		"medium": {
			"url": "/api/media/file/media/abc123-medium.jpg",
			"path": "media/abc123-medium.jpg",
			"width": 800,
			"height": 600,
			"mimeType": "image/jpeg",
			"filesize": 45210
		}
	}
}
```

The admin UI displays these variants as a thumbnail grid below the image preview.

## Plugin Config

```typescript
interface ImagePluginConfig {
	/** Custom ImageProcessor implementation. Defaults to NapiImageProcessor. */
	processor?: ImageProcessor;

	/** Global format preference: 'original' | 'webp' | 'avif' | 'jpeg'. Default: 'original' */
	formatPreference?: 'jpeg' | 'webp' | 'avif' | 'original';

	/** Max pixel count (width * height) before rejecting. Prevents decompression bombs. Default: 100_000_000 */
	maxPixels?: number;
}
```

## Custom Processor

You can provide your own `ImageProcessor` implementation if you want to use a different image library:

```typescript
import type { ImageProcessor } from '@momentumcms/core';

class MyCustomProcessor implements ImageProcessor {
	async getDimensions(buffer: Uint8Array, mimeType: string) {
		// Return { width, height }
	}

	async processVariant(buffer: Uint8Array, mimeType: string, size, focalPoint?) {
		// Return { buffer, width, height, mimeType }
	}
}

imagePlugin({ processor: new MyCustomProcessor() });
```

## Related

- [Storage Overview](../storage/overview.md) — Storage adapters for uploaded files
- [Plugin Overview](overview.md) — Plugin system architecture
- [Writing a Plugin](writing-a-plugin.md) — Build your own plugin
