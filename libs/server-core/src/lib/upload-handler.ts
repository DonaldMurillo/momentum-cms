/**
 * Upload Handler for Momentum CMS
 * Framework-agnostic file upload handling
 */

import type {
	StorageAdapter,
	UploadedFile,
	StoredFile,
	MomentumConfig,
	MediaDocument,
	UploadCollectionConfig,
} from '@momentumcms/core';
import { validateMimeType as validateMimeByMagicBytes } from '@momentumcms/storage';
import { getMomentumAPI, type MomentumAPIContext } from './momentum-api';

/**
 * Upload request from the client.
 */
export interface UploadRequest {
	/** Uploaded file data */
	file: UploadedFile;
	/** User context for access control */
	user?: MomentumAPIContext['user'];
	/** Alt text for the file (for images) */
	alt?: string;
	/** Target collection (defaults to 'media') */
	collection?: string;
}

/**
 * Upload response returned to the client.
 */
export interface UploadResponse {
	/** Created media document */
	doc?: MediaDocument;
	/** Error message if upload failed */
	error?: string;
	/** HTTP status code */
	status: number;
}

/**
 * Upload configuration from MomentumConfig.
 */
export interface UploadConfig {
	/** Storage adapter for file storage */
	adapter: StorageAdapter;
	/** Maximum file size in bytes */
	maxFileSize?: number;
	/** Allowed MIME types */
	allowedMimeTypes?: string[];
}

/**
 * Get upload configuration from MomentumConfig.
 */
export function getUploadConfig(config: MomentumConfig): UploadConfig | null {
	if (!config.storage?.adapter) {
		return null;
	}

	return {
		adapter: config.storage.adapter,
		maxFileSize: config.storage.maxFileSize ?? 10 * 1024 * 1024, // Default 10MB
		allowedMimeTypes: config.storage.allowedMimeTypes ?? [
			'image/*',
			'application/pdf',
			'video/*',
			'audio/*',
		],
	};
}

/**
 * Validate file size.
 */
function validateFileSize(file: UploadedFile, maxSize: number): string | null {
	if (file.size > maxSize) {
		const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
		const fileMB = (file.size / (1024 * 1024)).toFixed(1);
		return `File size ${fileMB}MB exceeds maximum allowed size of ${maxMB}MB`;
	}
	return null;
}

/**
 * Validate claimed MIME type against an allow-list.
 * Returns an error message if the type is not allowed, or null if OK.
 */
export function validateMimeType(mimeType: string, allowedTypes: string[]): string | null {
	if (allowedTypes.length === 0) {
		return null; // No restrictions
	}

	for (const pattern of allowedTypes) {
		if (pattern === '*' || pattern === '*/*') {
			return null;
		}
		if (pattern.endsWith('/*')) {
			const category = pattern.slice(0, -2);
			if (mimeType.startsWith(`${category}/`)) {
				return null;
			}
		} else if (mimeType === pattern) {
			return null;
		}
	}

	return `File type '${mimeType}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`;
}

/**
 * Handle file upload.
 *
 * @param config - Upload configuration
 * @param request - Upload request with file and user context
 * @returns Upload response with created media document or error
 */
export async function handleUpload(
	config: UploadConfig,
	request: UploadRequest,
): Promise<UploadResponse> {
	const { adapter, maxFileSize = 10 * 1024 * 1024, allowedMimeTypes = [] } = config;
	const { file, user, alt, collection = 'media' } = request;

	try {
		// Check if user is authenticated
		if (!user) {
			return {
				status: 401,
				error: 'Authentication required to upload files',
			};
		}

		// Validate file size
		const sizeError = validateFileSize(file, maxFileSize);
		if (sizeError) {
			return {
				status: 400,
				error: sizeError,
			};
		}

		// Validate claimed MIME type against allowed list
		const mimeError = validateMimeType(file.mimeType, allowedMimeTypes);
		if (mimeError) {
			return {
				status: 400,
				error: mimeError,
			};
		}

		// Validate actual file content via magic bytes
		if (file.buffer && file.buffer.length > 0) {
			const magicByteResult = validateMimeByMagicBytes(
				file.buffer,
				file.mimeType,
				allowedMimeTypes,
			);
			if (!magicByteResult.valid) {
				return {
					status: 400,
					error: magicByteResult.error ?? 'File content does not match claimed type',
				};
			}
		}

		// Store file using the storage adapter
		const storedFile: StoredFile = await adapter.upload(file);

		// Build media data
		const mediaData: Record<string, unknown> = {
			filename: file.originalName,
			mimeType: file.mimeType,
			filesize: file.size,
			path: storedFile.path,
			url: storedFile.url,
			alt: alt ?? '',
		};

		// Create media document in the database
		const api = getMomentumAPI().setContext({ user });
		const doc = await api.collection<MediaDocument>(collection).create(mediaData);

		return {
			status: 201,
			doc,
		};
	} catch (error) {
		// Handle specific error types
		if (error instanceof Error) {
			if (error.message.includes('Access denied')) {
				return {
					status: 403,
					error: error.message,
				};
			}
			return {
				status: 500,
				error: `Upload failed: ${error.message}`,
			};
		}

		return {
			status: 500,
			error: 'Upload failed: Unknown error',
		};
	}
}

// ============================================
// Collection-Level Upload (Payload pattern)
// ============================================

/**
 * Upload request for a collection-level upload.
 * Used when POST /api/{slug} with multipart/form-data hits an upload collection.
 */
export interface CollectionUploadRequest {
	/** The uploaded file */
	file: UploadedFile;
	/** User context for access control */
	user?: MomentumAPIContext['user'];
	/** Non-file form fields from multipart body (e.g., alt, title) */
	fields: Record<string, unknown>;
	/** Target collection slug */
	collectionSlug: string;
	/** Collection-level upload config */
	collectionUpload: UploadCollectionConfig;
}

/**
 * Response from a collection-level upload.
 */
export interface CollectionUploadResponse {
	/** Created document (with auto-populated file metadata) */
	doc?: Record<string, unknown>;
	/** Error message if upload failed */
	error?: string;
	/** HTTP status code */
	status: number;
}

/**
 * Handle file upload for an upload collection.
 * Stores the file, auto-populates metadata fields, merges with user-provided fields,
 * and creates the document in the target collection.
 *
 * Collection-level config overrides global config for mimeTypes and maxFileSize.
 *
 * @param globalConfig - Global upload configuration (storage adapter, defaults)
 * @param request - Collection upload request with file, user fields, and collection config
 * @returns Response with created document or error
 */
export async function handleCollectionUpload(
	globalConfig: UploadConfig,
	request: CollectionUploadRequest,
): Promise<CollectionUploadResponse> {
	const { adapter } = globalConfig;
	const { file, user, fields, collectionSlug, collectionUpload } = request;

	// Resolve limits: collection overrides global
	const maxFileSize = collectionUpload.maxFileSize ?? globalConfig.maxFileSize ?? 10 * 1024 * 1024;
	const allowedMimeTypes = collectionUpload.mimeTypes ?? globalConfig.allowedMimeTypes ?? [];

	try {
		// 1. Auth check
		if (!user) {
			return {
				status: 401,
				error: 'Authentication required to upload files',
			};
		}

		// 2. Validate file size
		const sizeError = validateFileSize(file, maxFileSize);
		if (sizeError) {
			return { status: 400, error: sizeError };
		}

		// 3. Validate claimed MIME type
		const mimeError = validateMimeType(file.mimeType, allowedMimeTypes);
		if (mimeError) {
			return { status: 400, error: mimeError };
		}

		// 4. Validate actual file content via magic bytes
		if (file.buffer && file.buffer.length > 0) {
			const magicByteResult = validateMimeByMagicBytes(
				file.buffer,
				file.mimeType,
				allowedMimeTypes,
			);
			if (!magicByteResult.valid) {
				return {
					status: 400,
					error: magicByteResult.error ?? 'File content does not match claimed type',
				};
			}
		}

		// 5. Store file via adapter
		const storedFile: StoredFile = await adapter.upload(file);

		// 6. Build document data: user fields first, then auto-populated metadata wins
		const docData: Record<string, unknown> = {
			...fields,
			filename: file.originalName,
			mimeType: file.mimeType,
			filesize: file.size,
			path: storedFile.path,
			url: storedFile.url,
		};

		// 7. Create document in the target collection
		const api = getMomentumAPI().setContext({ user });
		const doc = await api.collection<Record<string, unknown>>(collectionSlug).create(docData);

		return {
			status: 201,
			doc,
		};
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('Access denied')) {
				return { status: 403, error: error.message };
			}
			return { status: 500, error: `Upload failed: ${error.message}` };
		}
		return { status: 500, error: 'Upload failed: Unknown error' };
	}
}

/**
 * Handle file deletion.
 *
 * @param adapter - Storage adapter
 * @param path - Storage path of the file to delete
 * @returns True if deleted, false if not found
 */
export async function handleFileDelete(adapter: StorageAdapter, path: string): Promise<boolean> {
	return adapter.delete(path);
}

/**
 * Handle file retrieval for serving.
 *
 * @param adapter - Storage adapter
 * @param path - Storage path of the file
 * @returns File buffer and metadata, or null if not found
 */
export async function handleFileGet(
	adapter: StorageAdapter,
	path: string,
): Promise<{ buffer: Uint8Array; mimeType?: string } | null> {
	// Check if the adapter supports reading
	if (!adapter.read) {
		return null;
	}

	const buffer = await adapter.read(path);
	if (!buffer) {
		return null;
	}

	// Try to detect MIME type from extension
	const mimeType = getMimeTypeFromPath(path);

	return { buffer, mimeType };
}

/**
 * Get MIME type from file path extension.
 */
function getMimeTypeFromPath(path: string): string | undefined {
	const ext = path.split('.').pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		webp: 'image/webp',
		svg: 'image/svg+xml',
		pdf: 'application/pdf',
		json: 'application/json',
		txt: 'text/plain',
		html: 'text/html',
		css: 'text/css',
		js: 'application/javascript',
		mp4: 'video/mp4',
		webm: 'video/webm',
		mp3: 'audio/mpeg',
		wav: 'audio/wav',
		zip: 'application/zip',
	};

	return ext ? mimeTypes[ext] : undefined;
}
