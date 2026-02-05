/**
 * Storage module for Momentum CMS
 * Defines interfaces for file storage adapters
 */

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
	/** File content as Buffer */
	buffer: Buffer;
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
	read?(path: string): Promise<Buffer | null>;
}
