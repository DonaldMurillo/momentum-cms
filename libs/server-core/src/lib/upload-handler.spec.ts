import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
	StorageAdapter,
	UploadedFile,
	StoredFile,
	MomentumConfig,
	UploadCollectionConfig,
} from '@momentumcms/core';
import {
	getUploadConfig,
	handleUpload,
	handleCollectionUpload,
	handleFileGet,
	handleFileDelete,
	type UploadConfig,
	type UploadRequest,
	type CollectionUploadRequest,
} from './upload-handler';

// Only mock getMomentumAPI (server singleton with DB).
// validateMimeType is a pure function — use the real implementation.
vi.mock('./momentum-api', () => ({
	getMomentumAPI: vi.fn(),
}));

import { getMomentumAPI } from './momentum-api';

function createMockAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
	return {
		upload: vi.fn<(file: UploadedFile) => Promise<StoredFile>>().mockResolvedValue({
			path: 'abc123.jpg',
			url: '/api/media/file/abc123.jpg',
			filename: 'abc123.jpg',
			mimeType: 'image/jpeg',
			size: 22,
		}),
		delete: vi.fn<(path: string) => Promise<boolean>>().mockResolvedValue(true),
		getUrl: vi.fn<(path: string) => string>().mockReturnValue('/api/media/file/abc123.jpg'),
		exists: vi.fn<(path: string) => Promise<boolean>>().mockResolvedValue(true),
		read: vi.fn<(path: string) => Promise<Buffer | null>>().mockResolvedValue(
			Buffer.from([0xff, 0xd8, 0xff]),
		),
		...overrides,
	};
}

// Real JPEG magic bytes so real validateMimeType passes
const JPEG_MAGIC = Buffer.from([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

// Real PNG magic bytes
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

// EXE magic bytes (MZ header) — for spoofing tests
const EXE_MAGIC = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

function createTestFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
	return {
		originalName: 'test-image.jpg',
		mimeType: 'image/jpeg',
		size: 22,
		buffer: JPEG_MAGIC,
		...overrides,
	};
}

const mockUser = { id: 'user-1', email: 'test@example.com', role: 'admin' };

describe('getUploadConfig', () => {
	it('should return null when config has no storage', () => {
		const config = { collections: [], db: { adapter: {} } } as unknown as MomentumConfig;
		expect(getUploadConfig(config)).toBeNull();
	});

	it('should return null when config.storage has no adapter', () => {
		const config = {
			collections: [],
			db: { adapter: {} },
			storage: {},
		} as unknown as MomentumConfig;
		expect(getUploadConfig(config)).toBeNull();
	});

	it('should return config with defaults when no limits specified', () => {
		const mockAdapter = createMockAdapter();
		const config = {
			collections: [],
			db: { adapter: {} },
			storage: { adapter: mockAdapter },
		} as unknown as MomentumConfig;

		const result = getUploadConfig(config);
		expect(result).not.toBeNull();
		expect(result!.adapter).toBe(mockAdapter);
		expect(result!.maxFileSize).toBe(10 * 1024 * 1024);
		expect(result!.allowedMimeTypes).toContain('image/*');
	});

	it('should use custom maxFileSize when provided', () => {
		const config = {
			collections: [],
			db: { adapter: {} },
			storage: { adapter: createMockAdapter(), maxFileSize: 5000 },
		} as unknown as MomentumConfig;

		const result = getUploadConfig(config);
		expect(result!.maxFileSize).toBe(5000);
	});

	it('should use custom allowedMimeTypes when provided', () => {
		const config = {
			collections: [],
			db: { adapter: {} },
			storage: {
				adapter: createMockAdapter(),
				allowedMimeTypes: ['image/png'],
			},
		} as unknown as MomentumConfig;

		const result = getUploadConfig(config);
		expect(result!.allowedMimeTypes).toEqual(['image/png']);
	});
});

describe('handleUpload', () => {
	let mockAdapter: StorageAdapter;
	let uploadConfig: UploadConfig;
	let mockCreate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockAdapter = createMockAdapter();
		uploadConfig = {
			adapter: mockAdapter,
			maxFileSize: 10 * 1024 * 1024,
			allowedMimeTypes: ['image/*', 'application/pdf'],
		};

		// Setup getMomentumAPI mock chain — this is a DB singleton, must be mocked
		const createdDoc = {
			id: 'media-1',
			filename: 'test-image.jpg',
			mimeType: 'image/jpeg',
			filesize: 22,
			path: 'abc123.jpg',
			url: '/api/media/file/abc123.jpg',
			alt: '',
			createdAt: '2025-01-01T00:00:00Z',
			updatedAt: '2025-01-01T00:00:00Z',
		};
		mockCreate = vi.fn().mockResolvedValue(createdDoc);
		const mockCollection = vi.fn().mockReturnValue({ create: mockCreate });
		const mockSetContext = vi.fn().mockReturnValue({ collection: mockCollection });
		vi.mocked(getMomentumAPI).mockReturnValue({
			setContext: mockSetContext,
		} as ReturnType<typeof getMomentumAPI>);
	});

	it('should return 401 when user is not provided', async () => {
		const request: UploadRequest = { file: createTestFile(), user: undefined };
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(401);
		expect(response.error).toContain('Authentication required');
		expect(response.doc).toBeUndefined();
	});

	it('should return 400 when file exceeds max size', async () => {
		const request: UploadRequest = {
			file: createTestFile({ size: 20 * 1024 * 1024 }),
			user: mockUser,
		};
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toContain('exceeds maximum');
	});

	it('should allow file at exactly max size (boundary value)', async () => {
		const exactMaxConfig: UploadConfig = {
			...uploadConfig,
			maxFileSize: 22, // exactly the test file size
		};
		const request: UploadRequest = {
			file: createTestFile({ size: 22 }),
			user: mockUser,
		};
		const response = await handleUpload(exactMaxConfig, request);

		expect(response.status).toBe(201);
	});

	it('should reject file one byte over max size (boundary value)', async () => {
		const exactMaxConfig: UploadConfig = {
			...uploadConfig,
			maxFileSize: 21,
		};
		const request: UploadRequest = {
			file: createTestFile({ size: 22 }),
			user: mockUser,
		};
		const response = await handleUpload(exactMaxConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toContain('exceeds maximum');
	});

	it('should return 400 when MIME type is not in allowed list', async () => {
		const request: UploadRequest = {
			file: createTestFile({ mimeType: 'application/zip' }),
			user: mockUser,
		};
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toContain('not allowed');
	});

	it('should return 400 when real magic bytes do not match claimed type', async () => {
		// PNG buffer claimed as JPEG — real validateMimeType will catch this
		const request: UploadRequest = {
			file: createTestFile({ buffer: PNG_MAGIC, mimeType: 'image/jpeg' }),
			user: mockUser,
		};
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toBeDefined();
	});

	it('should return 400 when EXE disguised as JPEG (spoofing)', async () => {
		const request: UploadRequest = {
			file: createTestFile({ buffer: EXE_MAGIC, mimeType: 'image/jpeg' }),
			user: mockUser,
		};
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toBeDefined();
	});

	it('should call adapter.upload and return 201 on success', async () => {
		const file = createTestFile();
		const request: UploadRequest = { file, user: mockUser };
		const response = await handleUpload(uploadConfig, request);

		expect(mockAdapter.upload).toHaveBeenCalledOnce();
		expect(mockAdapter.upload).toHaveBeenCalledWith(file);
		expect(response.status).toBe(201);
		expect(response.doc).toBeDefined();
	});

	it('should create media document with correct data on success', async () => {
		const request: UploadRequest = { file: createTestFile(), user: mockUser };
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(201);
		expect(mockCreate).toHaveBeenCalledOnce();
		const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
		expect(createArg).toMatchObject({
			filename: 'test-image.jpg',
			mimeType: 'image/jpeg',
			filesize: 22,
			path: 'abc123.jpg',
			url: '/api/media/file/abc123.jpg',
		});
	});

	it('should return 201 with doc on successful upload', async () => {
		const request: UploadRequest = { file: createTestFile(), user: mockUser };
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(201);
		expect(response.doc).toBeDefined();
		expect(response.doc!.id).toBe('media-1');
	});

	it('should include alt text in media document when provided', async () => {
		const request: UploadRequest = {
			file: createTestFile(),
			user: mockUser,
			alt: 'A beautiful landscape',
		};
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(201);
		const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
		expect(createArg.alt).toBe('A beautiful landscape');
	});

	it('should default alt text to empty string when not provided', async () => {
		const request: UploadRequest = { file: createTestFile(), user: mockUser };
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(201);
		const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
		expect(createArg.alt).toBe('');
	});

	it('should use custom collection slug when provided', async () => {
		const mockCollection = vi.fn().mockReturnValue({ create: mockCreate });
		const mockSetContext = vi.fn().mockReturnValue({ collection: mockCollection });
		vi.mocked(getMomentumAPI).mockReturnValue({
			setContext: mockSetContext,
		} as ReturnType<typeof getMomentumAPI>);

		const request: UploadRequest = {
			file: createTestFile(),
			user: mockUser,
			collection: 'documents',
		};
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(201);
		expect(mockCollection).toHaveBeenCalledWith('documents');
	});

	it('should return 403 on access denied error', async () => {
		mockCreate.mockRejectedValue(new Error('Access denied: insufficient permissions'));

		const request: UploadRequest = { file: createTestFile(), user: mockUser };
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(403);
		expect(response.error).toContain('Access denied');
	});

	it('should return 500 on unexpected error', async () => {
		vi.mocked(mockAdapter.upload).mockRejectedValue(new Error('disk full'));

		const request: UploadRequest = { file: createTestFile(), user: mockUser };
		const response = await handleUpload(uploadConfig, request);

		expect(response.status).toBe(500);
		expect(response.error).toContain('Upload failed');
	});

	it('should skip magic byte validation for empty buffer and still succeed', async () => {
		const request: UploadRequest = {
			file: createTestFile({ buffer: Buffer.alloc(0), size: 0 }),
			user: mockUser,
		};
		const response = await handleUpload(uploadConfig, request);

		// Should succeed — empty buffer skips magic byte check
		expect(response.status).toBe(201);
		expect(response.doc).toBeDefined();
	});

	it('should allow all MIME types with wildcard pattern', async () => {
		const wildcardConfig: UploadConfig = {
			...uploadConfig,
			allowedMimeTypes: ['*/*'],
		};
		const request: UploadRequest = {
			file: createTestFile({ mimeType: 'application/zip', buffer: JPEG_MAGIC }),
			user: mockUser,
		};
		const response = await handleUpload(wildcardConfig, request);

		// The claimed MIME type 'application/zip' passes the wildcard allowedMimeTypes check,
		// but magic bytes detect image/jpeg which mismatches 'application/zip'
		expect(response.status).toBe(400);
	});
});

describe('handleFileGet', () => {
	it('should return buffer and mimeType for existing file', async () => {
		const mockAdapter = createMockAdapter();
		const result = await handleFileGet(mockAdapter, 'test.jpg');

		expect(result).not.toBeNull();
		expect(result!.buffer).toBeInstanceOf(Buffer);
		expect(result!.mimeType).toBe('image/jpeg');
	});

	it('should return null when file not found', async () => {
		const mockAdapter = createMockAdapter({
			read: vi.fn<(path: string) => Promise<Buffer | null>>().mockResolvedValue(null),
		});
		const result = await handleFileGet(mockAdapter, 'missing.jpg');

		expect(result).toBeNull();
	});

	it('should return null when adapter has no read method', async () => {
		const mockAdapter = createMockAdapter();
		delete (mockAdapter as Partial<StorageAdapter>).read;

		const result = await handleFileGet(mockAdapter, 'test.jpg');
		expect(result).toBeNull();
	});

	it('should detect MIME type from file extension', async () => {
		const mockAdapter = createMockAdapter();
		const result = await handleFileGet(mockAdapter, 'document.png');

		expect(result!.mimeType).toBe('image/png');
	});

	it('should return undefined mimeType for unknown extension', async () => {
		const mockAdapter = createMockAdapter();
		const result = await handleFileGet(mockAdapter, 'file.xyz');

		expect(result!.mimeType).toBeUndefined();
	});
});

describe('handleFileDelete', () => {
	it('should delegate to adapter.delete and return result', async () => {
		const mockAdapter = createMockAdapter();
		const result = await handleFileDelete(mockAdapter, 'some-file.jpg');

		expect(result).toBe(true);
		expect(mockAdapter.delete).toHaveBeenCalledWith('some-file.jpg');
	});

	it('should return false when file not found', async () => {
		const mockAdapter = createMockAdapter({
			delete: vi.fn<(path: string) => Promise<boolean>>().mockResolvedValue(false),
		});
		const result = await handleFileDelete(mockAdapter, 'nope.jpg');

		expect(result).toBe(false);
	});
});

describe('handleCollectionUpload', () => {
	let mockAdapter: StorageAdapter;
	let globalConfig: UploadConfig;
	let mockCreate: ReturnType<typeof vi.fn>;
	let mockCollection: ReturnType<typeof vi.fn>;

	const collectionUpload: UploadCollectionConfig = {
		mimeTypes: ['image/*', 'application/pdf'],
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockAdapter = createMockAdapter();
		globalConfig = {
			adapter: mockAdapter,
			maxFileSize: 10 * 1024 * 1024,
			allowedMimeTypes: ['image/*', 'application/pdf', 'video/*', 'audio/*'],
		};

		const createdDoc = {
			id: 'media-1',
			filename: 'test-image.jpg',
			mimeType: 'image/jpeg',
			filesize: 22,
			path: 'abc123.jpg',
			url: '/api/media/file/abc123.jpg',
			alt: 'test alt',
			createdAt: '2025-01-01T00:00:00Z',
			updatedAt: '2025-01-01T00:00:00Z',
		};
		mockCreate = vi.fn().mockResolvedValue(createdDoc);
		mockCollection = vi.fn().mockReturnValue({ create: mockCreate });
		const mockSetContext = vi.fn().mockReturnValue({ collection: mockCollection });
		vi.mocked(getMomentumAPI).mockReturnValue({
			setContext: mockSetContext,
		} as ReturnType<typeof getMomentumAPI>);
	});

	function createCollectionUploadRequest(
		overrides: Partial<CollectionUploadRequest> = {},
	): CollectionUploadRequest {
		return {
			file: createTestFile(),
			user: mockUser,
			fields: {},
			collectionSlug: 'media',
			collectionUpload,
			...overrides,
		};
	}

	it('should return 401 when user is not provided', async () => {
		const request = createCollectionUploadRequest({ user: undefined });
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(401);
		expect(response.error).toContain('Authentication required');
	});

	it('should return 400 when file exceeds collection maxFileSize', async () => {
		const request = createCollectionUploadRequest({
			file: createTestFile({ size: 6 * 1024 * 1024 }),
			collectionUpload: { maxFileSize: 5 * 1024 * 1024 },
		});
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toContain('exceeds maximum');
	});

	it('should fall back to global maxFileSize when collection does not specify one', async () => {
		const smallGlobalConfig: UploadConfig = {
			...globalConfig,
			maxFileSize: 10, // too small
		};
		const request = createCollectionUploadRequest({
			file: createTestFile({ size: 22 }),
			collectionUpload: {}, // no maxFileSize override
		});
		const response = await handleCollectionUpload(smallGlobalConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toContain('exceeds maximum');
	});

	it('should return 400 when MIME type not in collection mimeTypes', async () => {
		const request = createCollectionUploadRequest({
			file: createTestFile({ mimeType: 'video/mp4', buffer: JPEG_MAGIC }),
			collectionUpload: { mimeTypes: ['image/*'] },
		});
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toContain('not allowed');
	});

	it('should fall back to global allowedMimeTypes when collection does not specify them', async () => {
		const restrictiveGlobal: UploadConfig = {
			...globalConfig,
			allowedMimeTypes: ['image/png'], // only PNG
		};
		const request = createCollectionUploadRequest({
			file: createTestFile({ mimeType: 'image/jpeg' }),
			collectionUpload: {}, // no mimeTypes override
		});
		const response = await handleCollectionUpload(restrictiveGlobal, request);

		expect(response.status).toBe(400);
		expect(response.error).toContain('not allowed');
	});

	it('should return 400 when magic bytes mismatch', async () => {
		const request = createCollectionUploadRequest({
			file: createTestFile({ buffer: PNG_MAGIC, mimeType: 'image/jpeg' }),
		});
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(400);
		expect(response.error).toBeDefined();
	});

	it('should merge user fields with auto-populated metadata on success', async () => {
		const request = createCollectionUploadRequest({
			fields: { alt: 'sunset photo', customField: 'extra data' },
		});
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(201);
		expect(mockCreate).toHaveBeenCalledOnce();

		const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
		// Auto-populated metadata
		expect(createArg.filename).toBe('test-image.jpg');
		expect(createArg.mimeType).toBe('image/jpeg');
		expect(createArg.filesize).toBe(22);
		expect(createArg.path).toBe('abc123.jpg');
		expect(createArg.url).toBe('/api/media/file/abc123.jpg');
		// User-provided fields preserved
		expect(createArg.alt).toBe('sunset photo');
		expect(createArg.customField).toBe('extra data');
	});

	it('should auto-populated metadata override user-provided duplicates', async () => {
		const request = createCollectionUploadRequest({
			fields: {
				filename: 'user-override.txt',
				mimeType: 'text/plain',
				filesize: 99999,
			},
		});
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(201);
		const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
		// Auto-populated values win over user-provided duplicates
		expect(createArg.filename).toBe('test-image.jpg');
		expect(createArg.mimeType).toBe('image/jpeg');
		expect(createArg.filesize).toBe(22);
	});

	it('should use the provided collection slug', async () => {
		const request = createCollectionUploadRequest({
			collectionSlug: 'documents',
		});
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(201);
		expect(mockCollection).toHaveBeenCalledWith('documents');
	});

	it('should return 201 with created doc on success', async () => {
		const request = createCollectionUploadRequest();
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(201);
		expect(response.doc).toBeDefined();
		expect(response.doc!.id).toBe('media-1');
	});

	it('should return 403 on access denied error', async () => {
		mockCreate.mockRejectedValue(new Error('Access denied: insufficient permissions'));

		const request = createCollectionUploadRequest();
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(403);
		expect(response.error).toContain('Access denied');
	});

	it('should return 500 on unexpected storage error', async () => {
		vi.mocked(mockAdapter.upload).mockRejectedValue(new Error('disk full'));

		const request = createCollectionUploadRequest();
		const response = await handleCollectionUpload(globalConfig, request);

		expect(response.status).toBe(500);
		expect(response.error).toContain('Upload failed');
	});
});
