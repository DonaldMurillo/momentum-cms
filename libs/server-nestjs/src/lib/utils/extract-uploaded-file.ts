import type { Request } from 'express';
import type { UploadedFile } from '@momentumcms/core';

interface MulterFileShape {
	originalname: string;
	mimetype: string;
	size: number;
	buffer: Buffer;
}

/**
 * Convert a multer-decorated Express request into the framework-neutral
 * {@link UploadedFile} shape that `@momentumcms/server-core` handlers consume.
 *
 * Returns `null` when no file is attached — handlers translate that into the
 * appropriate 400 response.
 */
export function extractUploadedFile(req: Request): UploadedFile | null {
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- multer decorates req.file when FileInterceptor is wired upstream
	const multerFile = (req as unknown as { file?: MulterFileShape }).file;
	if (!multerFile) return null;
	return {
		originalName: multerFile.originalname,
		mimeType: multerFile.mimetype,
		size: multerFile.size,
		buffer: multerFile.buffer,
	};
}
