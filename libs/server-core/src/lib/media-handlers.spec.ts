import { describe, it, expect } from 'vitest';
import {
	validateMediaFilePath,
	handleMediaServeRequest,
	handleMediaUploadRequest,
	handleMediaCollectionUploadRequest,
} from './media-handlers';

describe('validateMediaFilePath', () => {
	it('accepts a simple relative path', async () => {
		const result = await validateMediaFilePath('uploads/photo.jpg');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.path).toContain('uploads');
		}
	});

	it('rejects path traversal with ..', async () => {
		const result = await validateMediaFilePath('../etc/passwd');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(403);
		}
	});

	it('rejects absolute paths', async () => {
		const result = await validateMediaFilePath('/etc/passwd');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(403);
		}
	});

	it('rejects malformed URI encoding', async () => {
		const result = await validateMediaFilePath('%E0%A4%A');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.status).toBe(400);
			expect(result.error).toBe('Invalid path encoding');
		}
	});
});

describe('handleMediaServeRequest', () => {
	it('returns 500 when storage is not configured', async () => {
		const result = await handleMediaServeRequest({
			uploadConfig: null,
			rawPath: 'photo.jpg',
		});
		expect(result.status).toBe(500);
		expect(result.body).toMatchObject({ error: 'Storage not configured' });
	});

	it('returns 400 when no path is supplied', async () => {
		const result = await handleMediaServeRequest({
			uploadConfig: { adapter: { read: async () => null } } as never,
			rawPath: undefined,
		});
		expect(result.status).toBe(400);
	});

	it('returns 403 on path traversal attempt', async () => {
		const result = await handleMediaServeRequest({
			uploadConfig: { adapter: { read: async () => null } } as never,
			rawPath: '../secret',
		});
		expect(result.status).toBe(403);
	});

	it('returns 404 when the file does not exist', async () => {
		const result = await handleMediaServeRequest({
			uploadConfig: { adapter: { read: async () => null } } as never,
			rawPath: 'nonexistent.jpg',
		});
		expect(result.status).toBe(404);
	});

	it('returns the buffer with content-type when the file exists', async () => {
		const buffer = new Uint8Array([1, 2, 3]);
		const result = await handleMediaServeRequest({
			uploadConfig: { adapter: { read: async () => buffer } } as never,
			rawPath: 'photo.jpg',
		});
		expect(result.status).toBe(200);
		expect(result.headers?.['Content-Type']).toBe('image/jpeg');
	});
});

describe('handleMediaUploadRequest', () => {
	it('returns 401 when no user is supplied', async () => {
		const result = await handleMediaUploadRequest({
			uploadConfig: null,
			file: null,
			user: undefined,
		});
		expect(result.status).toBe(401);
	});

	it('returns 500 when storage is not configured', async () => {
		const result = await handleMediaUploadRequest({
			uploadConfig: null,
			file: null,
			user: { id: 'u-1' },
		});
		expect(result.status).toBe(500);
		expect(result.body).toMatchObject({ error: 'Storage not configured' });
	});

	it('returns 400 when no file is supplied', async () => {
		const result = await handleMediaUploadRequest({
			uploadConfig: { adapter: {} } as never,
			file: null,
			user: { id: 'u-1' },
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'No file provided' });
	});
});

describe('handleMediaCollectionUploadRequest', () => {
	it('returns 400 when the collection is not an upload collection', async () => {
		const result = await handleMediaCollectionUploadRequest({
			uploadConfig: null,
			collectionSlug: 'posts',
			collectionUpload: undefined,
			file: null,
			fields: {},
			user: undefined,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'Not an upload collection' });
	});

	it('returns 500 when storage is not configured', async () => {
		const result = await handleMediaCollectionUploadRequest({
			uploadConfig: null,
			collectionSlug: 'media',
			collectionUpload: true,
			file: null,
			fields: {},
			user: undefined,
		});
		expect(result.status).toBe(500);
	});

	it('returns 400 when no file is supplied', async () => {
		const result = await handleMediaCollectionUploadRequest({
			uploadConfig: { adapter: {} } as never,
			collectionSlug: 'media',
			collectionUpload: true,
			file: null,
			fields: {},
			user: undefined,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ error: 'No file provided' });
	});
});
