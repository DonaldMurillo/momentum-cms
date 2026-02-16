/**
 * Local Filesystem Storage Adapter
 * Stores files on the local filesystem
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync, lstatSync } from 'node:fs';
import { join, extname, resolve, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StorageAdapter, UploadedFile, StoredFile, UploadOptions } from '@momentumcms/core';
import type { LocalStorageOptions } from './storage.types';

/**
 * Creates a local filesystem storage adapter.
 *
 * @example
 * ```typescript
 * const storage = localStorageAdapter({
 *   directory: './uploads',
 *   baseUrl: 'http://localhost:4200/uploads'
 * });
 * ```
 */
export function localStorageAdapter(options: LocalStorageOptions): StorageAdapter {
	const { directory, baseUrl } = options;
	const resolvedRoot = resolve(directory);

	// Ensure the upload directory exists
	if (!existsSync(resolvedRoot)) {
		mkdirSync(resolvedRoot, { recursive: true });
	}

	/**
	 * Sanitize a path to prevent directory traversal attacks.
	 * Resolves the path relative to the upload root and verifies it stays within bounds.
	 */
	function safePath(unsafePath: string): string {
		const normalized = normalize(unsafePath).replace(/^(\.\.(\/|\\|$))+/, '');
		const full = resolve(resolvedRoot, normalized);
		if (!full.startsWith(resolvedRoot)) {
			throw new Error('Invalid path: directory traversal not allowed');
		}
		// Reject symlinks to prevent escape via symlink chains
		if (existsSync(full) && lstatSync(full).isSymbolicLink()) {
			throw new Error('Invalid path: symbolic links not allowed');
		}
		return full;
	}

	return {
		async upload(file: UploadedFile, uploadOptions?: UploadOptions): Promise<StoredFile> {
			// Generate unique filename
			const ext = extname(file.originalName) || getExtensionFromMimeType(file.mimeType);
			const filename = uploadOptions?.filename
				? `${uploadOptions.filename}${ext}`
				: `${randomUUID()}${ext}`;

			// Determine subdirectory (sanitized)
			const subdir = uploadOptions?.directory ?? '';
			const targetDir = subdir ? safePath(subdir) : resolvedRoot;

			// Ensure subdirectory exists
			if (subdir && !existsSync(targetDir)) {
				mkdirSync(targetDir, { recursive: true });
			}

			// Write file to disk (validate full path)
			const filePath = safePath(subdir ? join(subdir, filename) : filename);
			const relativePath = subdir ? join(normalize(subdir), filename) : filename;
			writeFileSync(filePath, file.buffer);

			// Generate URL
			const url = baseUrl ? `${baseUrl}/${relativePath}` : `/api/media/file/${relativePath}`;

			return {
				path: relativePath,
				url,
				filename,
				mimeType: file.mimeType,
				size: file.size,
			};
		},

		async delete(path: string): Promise<boolean> {
			const filePath = safePath(path);
			if (existsSync(filePath)) {
				unlinkSync(filePath);
				return true;
			}
			return false;
		},

		getUrl(path: string): string {
			return baseUrl ? `${baseUrl}/${path}` : `/api/media/file/${path}`;
		},

		async exists(path: string): Promise<boolean> {
			const filePath = safePath(path);
			return existsSync(filePath);
		},

		async read(path: string): Promise<Buffer | null> {
			const filePath = safePath(path);
			if (existsSync(filePath)) {
				return readFileSync(filePath);
			}
			return null;
		},
	};
}

/**
 * Get file extension from MIME type.
 */
function getExtensionFromMimeType(mimeType: string): string {
	const mimeToExt: Record<string, string> = {
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/webp': '.webp',
		'image/svg+xml': '.svg',
		'application/pdf': '.pdf',
		'application/json': '.json',
		'text/plain': '.txt',
		'text/html': '.html',
		'text/css': '.css',
		'application/javascript': '.js',
		'video/mp4': '.mp4',
		'video/webm': '.webm',
		'audio/mpeg': '.mp3',
		'audio/wav': '.wav',
		'application/zip': '.zip',
	};

	return mimeToExt[mimeType] ?? '';
}
