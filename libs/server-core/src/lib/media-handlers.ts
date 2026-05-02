/**
 * Shared media route handlers.
 *
 * Wraps the existing low-level upload/file-get helpers with the validation
 * and error envelopes that adapters were duplicating (path traversal guards,
 * auth checks, no-file checks, storage-not-configured checks).
 *
 * Adapters still own multipart parsing because that differs per framework
 * (multer for Express, h3.readMultipartFormData for Analog). They pass the
 * already-parsed UploadedFile into these handlers and translate the
 * resulting HandlerResult into their native response.
 */

import type {
	UploadedFile,
	UploadCollectionConfig,
	UserContext,
} from '@momentumcms/core';
import type { HandlerResult } from './import-export-handler';
import {
	handleUpload,
	handleCollectionUpload,
	handleFileGet,
	type UploadConfig,
} from './upload-handler';

// ============================================
// File path validation
// ============================================

/**
 * Validate a media file path, rejecting absolute paths and parent-directory
 * traversal. Mirrors the protection both adapters were implementing inline.
 */
export async function validateMediaFilePath(
	rawPath: string,
): Promise<
	| { ok: true; path: string }
	| { ok: false; status: number; error: string }
> {
	const { normalize, isAbsolute, resolve, sep } = await import('node:path');

	let decoded: string;
	try {
		decoded = decodeURIComponent(rawPath);
	} catch {
		return { ok: false, status: 400, error: 'Invalid path encoding' };
	}

	const normalized = normalize(decoded);
	if (
		isAbsolute(normalized) ||
		normalized.includes('..') ||
		normalized.includes(`${sep}..`)
	) {
		return { ok: false, status: 403, error: 'Invalid file path' };
	}

	// Resolve against a fake root and verify we stay inside it
	const fakeRoot = resolve('/safe-root');
	const resolved = resolve(fakeRoot, normalized);
	if (!resolved.startsWith(fakeRoot + sep) && resolved !== fakeRoot) {
		return { ok: false, status: 403, error: 'Invalid file path' };
	}

	return { ok: true, path: normalized };
}

// ============================================
// GET /media/file/*
// ============================================

export interface MediaServeParams {
	uploadConfig: UploadConfig | null;
	rawPath: string | undefined;
}

export interface MediaServeBody {
	buffer: Uint8Array;
	mimeType?: string;
}

/**
 * Serve a file from the configured storage adapter.
 * On success the body contains the buffer + mime type for the adapter to
 * write directly to the response stream.
 */
export async function handleMediaServeRequest(
	params: MediaServeParams,
): Promise<HandlerResult> {
	if (!params.uploadConfig) {
		return { status: 500, body: { error: 'Storage not configured' } };
	}
	if (!params.rawPath) {
		return { status: 400, body: { error: 'File path required' } };
	}

	const validated = await validateMediaFilePath(params.rawPath);
	if (!validated.ok) {
		return { status: validated.status, body: { error: validated.error } };
	}

	const result = await handleFileGet(params.uploadConfig.adapter, validated.path);
	if (!result) {
		return { status: 404, body: { error: 'File not found' } };
	}

	return {
		status: 200,
		body: result,
		headers: { 'Content-Type': result.mimeType ?? 'application/octet-stream' },
	};
}

// ============================================
// POST /media/upload (legacy)
// ============================================

export interface MediaUploadParams {
	uploadConfig: UploadConfig | null;
	file: UploadedFile | null;
	user: UserContext | undefined;
	alt?: string;
}

export async function handleMediaUploadRequest(
	params: MediaUploadParams,
): Promise<HandlerResult> {
	if (!params.user) {
		return {
			status: 401,
			body: { error: 'Authentication required to upload files' },
		};
	}
	if (!params.uploadConfig) {
		return { status: 500, body: { error: 'Storage not configured' } };
	}
	if (!params.file) {
		return { status: 400, body: { error: 'No file provided' } };
	}

	const response = await handleUpload(params.uploadConfig, {
		file: params.file,
		user: params.user,
		alt: params.alt,
	});
	return { status: response.status, body: response };
}

// ============================================
// POST /:collection (upload collection)
// ============================================

export interface MediaCollectionUploadParams {
	uploadConfig: UploadConfig | null;
	collectionSlug: string;
	collectionUpload: UploadCollectionConfig | true | undefined;
	file: UploadedFile | null;
	fields: Record<string, unknown>;
	user: UserContext | undefined;
}

export async function handleMediaCollectionUploadRequest(
	params: MediaCollectionUploadParams,
): Promise<HandlerResult> {
	if (!params.collectionUpload) {
		return { status: 400, body: { error: 'Not an upload collection' } };
	}
	if (!params.uploadConfig) {
		return { status: 500, body: { error: 'Storage not configured' } };
	}
	if (!params.file) {
		return { status: 400, body: { error: 'No file provided' } };
	}

	// `true` is shorthand for "this collection is an upload collection with default settings"
	const collectionUpload: UploadCollectionConfig =
		params.collectionUpload === true ? {} : params.collectionUpload;

	const response = await handleCollectionUpload(params.uploadConfig, {
		file: params.file,
		user: params.user,
		fields: params.fields,
		collectionSlug: params.collectionSlug,
		collectionUpload,
	});
	return { status: response.status, body: response };
}
