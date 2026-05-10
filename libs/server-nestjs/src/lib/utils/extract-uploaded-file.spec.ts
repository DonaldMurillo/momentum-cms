import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { extractUploadedFile } from './extract-uploaded-file';

function makeRequest(file?: unknown): Request {
	return { file } as unknown as Request;
}

describe('extractUploadedFile', () => {
	it('returns null when no multer file is attached', () => {
		expect(extractUploadedFile(makeRequest(undefined))).toBeNull();
	});

	it('maps the multer file shape to the framework-neutral UploadedFile', () => {
		const buffer = Buffer.from([0x01, 0x02, 0x03]);
		const result = extractUploadedFile(
			makeRequest({
				originalname: 'photo.png',
				mimetype: 'image/png',
				size: 3,
				buffer,
			}),
		);
		expect(result).toEqual({
			originalName: 'photo.png',
			mimeType: 'image/png',
			size: 3,
			buffer,
		});
	});
});
