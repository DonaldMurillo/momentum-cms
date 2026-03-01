/**
 * Storage module for Momentum CMS
 * Defines interfaces for file storage adapters and image processing
 */

// ============================================
// Image Processing
// ============================================

/**
 * Describes one output size for image processing.
 */
export interface ImageSizeConfig {
	/** Named key for this size (e.g. 'thumbnail', 'medium') */
	name: string;
	/** Target width in pixels. Undefined = proportional from height. */
	width?: number;
	/** Target height in pixels. Undefined = proportional from width. */
	height?: number;
	/**
	 * Resizing strategy.
	 * - 'contain': shrink to fit, no cropping
	 * - 'cover': resize + crop to fill exact dimensions (uses focalPoint)
	 * - 'fill': stretch to exact dimensions
	 * - 'width': resize to width, height proportional
	 * - 'height': resize to height, width proportional
	 * @default 'cover'
	 */
	fit?: 'contain' | 'cover' | 'fill' | 'width' | 'height';
	/** Output format. When undefined, uses source format or global formatPreference. */
	format?: 'jpeg' | 'webp' | 'avif' | 'png';
	/** JPEG/WebP/AVIF quality (1-100). @default 80 */
	quality?: number;
}

/**
 * Image dimensions in pixels.
 */
export interface ImageDimensions {
	width: number;
	height: number;
}

/**
 * Pluggable image processor interface.
 * Implement this to provide custom image processing backends.
 */
export interface ImageProcessor {
	/** Detect image dimensions without full decode when possible. */
	getDimensions(buffer: Uint8Array, mimeType: string): Promise<ImageDimensions>;

	/** Process one size variant. Returns the processed buffer and its dimensions. */
	processVariant(
		buffer: Uint8Array,
		mimeType: string,
		size: ImageSizeConfig,
		focalPoint?: { x: number; y: number },
	): Promise<{ buffer: Uint8Array; width: number; height: number; mimeType: string }>;
}

// ============================================
// File Storage
// ============================================

/**
 * Represents an uploaded file before storage.
 */
export interface UploadedFile {
	/** Original filename */
	originalName: string;
	/** MIME type of the file */
	mimeType: string;
	/** File size in bytes */
	size: number;
	/** File content (Uint8Array for universal compat; Node Buffer extends Uint8Array) */
	buffer: Uint8Array;
}

/**
 * Represents a file after it has been stored.
 */
export interface StoredFile {
	/** Storage path/key */
	path: string;
	/** Public URL to access the file */
	url: string;
	/** Stored filename */
	filename: string;
	/** MIME type */
	mimeType: string;
	/** File size in bytes */
	size: number;
}

/**
 * Options for upload operations.
 */
export interface UploadOptions {
	/** Custom filename (without extension) */
	filename?: string;
	/** Subdirectory within the upload directory */
	directory?: string;
}

/**
 * Storage adapter interface.
 * Implement this interface to create custom storage backends.
 */
export interface StorageAdapter {
	/**
	 * Upload a file to storage.
	 * @param file - The file to upload
	 * @param options - Upload options
	 * @returns The stored file metadata
	 */
	upload(file: UploadedFile, options?: UploadOptions): Promise<StoredFile>;

	/**
	 * Delete a file from storage.
	 * @param path - The storage path/key of the file
	 * @returns True if deleted, false if not found
	 */
	delete(path: string): Promise<boolean>;

	/**
	 * Get the public URL for a stored file.
	 * @param path - The storage path/key
	 * @returns The public URL
	 */
	getUrl(path: string): string;

	/**
	 * Check if a file exists in storage.
	 * @param path - The storage path/key
	 * @returns True if exists
	 */
	exists(path: string): Promise<boolean>;

	/**
	 * Get a signed URL for temporary access (optional).
	 * Useful for private S3 buckets.
	 * @param path - The storage path/key
	 * @param expiresIn - Expiration time in seconds
	 * @returns The signed URL
	 */
	getSignedUrl?(path: string, expiresIn?: number): Promise<string>;

	/**
	 * Read a file from storage.
	 * @param path - The storage path/key
	 * @returns The file as a Buffer, or null if not found
	 */
	read?(path: string): Promise<Uint8Array | null>;
}
