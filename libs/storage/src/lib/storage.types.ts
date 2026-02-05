/**
 * Storage Types for Momentum CMS
 * Re-exports core storage interfaces and adds implementation-specific types
 */

// Re-export core interfaces
export type { StorageAdapter, UploadedFile, StoredFile, UploadOptions } from '@momentum-cms/core';

/**
 * Options for local filesystem storage adapter.
 */
export interface LocalStorageOptions {
	/**
	 * Directory to store uploaded files.
	 * @default './uploads'
	 */
	directory: string;

	/**
	 * Base URL for serving files.
	 * If not provided, files will be served via the API.
	 * @example 'http://localhost:4200/uploads'
	 */
	baseUrl?: string;
}

/**
 * Options for S3-compatible storage adapter.
 */
export interface S3StorageOptions {
	/**
	 * S3 bucket name.
	 */
	bucket: string;

	/**
	 * AWS region (e.g., 'us-east-1').
	 */
	region: string;

	/**
	 * AWS access key ID.
	 * Can also be set via AWS_ACCESS_KEY_ID environment variable.
	 */
	accessKeyId?: string;

	/**
	 * AWS secret access key.
	 * Can also be set via AWS_SECRET_ACCESS_KEY environment variable.
	 */
	secretAccessKey?: string;

	/**
	 * Custom endpoint URL for S3-compatible services (MinIO, DigitalOcean Spaces, etc.).
	 * @example 'http://localhost:9000' for MinIO
	 */
	endpoint?: string;

	/**
	 * Base URL for public file access.
	 * If not provided, uses standard S3 URL format or generates presigned URLs.
	 */
	baseUrl?: string;

	/**
	 * Force path-style URLs instead of virtual-hosted style.
	 * Required for some S3-compatible services like MinIO.
	 * @default false
	 */
	forcePathStyle?: boolean;

	/**
	 * Default ACL for uploaded files.
	 * @default 'private'
	 */
	acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read';

	/**
	 * Default expiration time for presigned URLs in seconds.
	 * @default 3600 (1 hour)
	 */
	presignedUrlExpiry?: number;
}

/**
 * MIME type validation result.
 */
export interface MimeValidationResult {
	/** Whether the file is valid */
	valid: boolean;
	/** Detected MIME type from file signature */
	detectedType: string | null;
	/** Claimed MIME type from upload */
	claimedType: string;
	/** Error message if invalid */
	error?: string;
}

/**
 * File signature (magic bytes) for MIME type detection.
 */
export interface FileSignature {
	/** MIME type this signature identifies */
	mimeType: string;
	/** Byte pattern to match */
	bytes: number[];
	/** Offset from start of file */
	offset?: number;
}
