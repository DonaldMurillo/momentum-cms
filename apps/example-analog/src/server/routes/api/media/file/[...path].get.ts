import { defineEventHandler, getRouterParams, setResponseHeader, send, createError } from 'h3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// MIME type map
const mimeTypes: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	pdf: 'application/pdf',
	mp4: 'video/mp4',
	webm: 'video/webm',
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
};

/**
 * GET /api/media/file/[...path]
 * Serve uploaded files.
 */
export default defineEventHandler(async (event) => {
	const params = getRouterParams(event);
	const filePath = params['path'];

	if (!filePath) {
		throw createError({ statusCode: 400, message: 'File path required' });
	}

	// Construct full path
	const uploadDir = join(process.cwd(), 'data', 'uploads');
	const fullPath = join(uploadDir, filePath);

	// Security: ensure path doesn't escape upload directory
	if (!fullPath.startsWith(uploadDir)) {
		throw createError({ statusCode: 403, message: 'Access denied' });
	}

	if (!existsSync(fullPath)) {
		throw createError({ statusCode: 404, message: 'File not found' });
	}

	// Read file
	const fileBuffer = readFileSync(fullPath);

	// Determine MIME type from extension
	const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
	const mimeType = mimeTypes[extension] ?? 'application/octet-stream';

	// Set headers and send
	setResponseHeader(event, 'Content-Type', mimeType);
	setResponseHeader(event, 'Content-Length', fileBuffer.length.toString());

	return send(event, fileBuffer);
});
