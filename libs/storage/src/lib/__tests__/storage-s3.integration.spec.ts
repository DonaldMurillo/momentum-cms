/**
 * S3 Storage Adapter Integration Tests
 *
 * Runs against a real MinIO instance. The globalSetup (ensure-minio.ts)
 * handles starting MinIO and sets MINIO_AVAILABLE=true when ready.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { s3StorageAdapter } from '../storage-s3';
import type { StorageAdapter, UploadedFile } from '@momentumcms/core';

// ── Helpers ──────────────────────────────────────────────────

const MINIO_ENDPOINT = process.env['MINIO_ENDPOINT'] ?? 'http://localhost:9000';
const MINIO_ACCESS_KEY = 'minioadmin';
const MINIO_SECRET_KEY = 'minioadmin';
const MINIO_REGION = 'us-east-1';

function makeTestFile(
	content = 'hello world',
	name = 'test.txt',
	mimeType = 'text/plain',
): UploadedFile {
	const buffer = Buffer.from(content);
	return {
		originalName: name,
		mimeType,
		size: buffer.length,
		buffer,
	};
}

/**
 * Create a test bucket via the S3 API directly.
 * Uses the AWS SDK since we already depend on it.
 */
async function createBucket(bucketName: string): Promise<void> {
	const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3');
	const client = new S3Client({
		region: MINIO_REGION,
		endpoint: MINIO_ENDPOINT,
		forcePathStyle: true,
		credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
	});
	try {
		await client.send(new CreateBucketCommand({ Bucket: bucketName }));
	} catch (err: unknown) {
		// Bucket may already exist — ignore BucketAlreadyOwnedByYou
		if (err instanceof Error && !err.name.includes('BucketAlreadyOwnedByYou')) {
			throw err;
		}
	}
}

async function deleteBucket(bucketName: string): Promise<void> {
	const { S3Client, ListObjectsV2Command, DeleteObjectCommand, DeleteBucketCommand } = await import(
		'@aws-sdk/client-s3'
	);
	const client = new S3Client({
		region: MINIO_REGION,
		endpoint: MINIO_ENDPOINT,
		forcePathStyle: true,
		credentials: { accessKeyId: MINIO_ACCESS_KEY, secretAccessKey: MINIO_SECRET_KEY },
	});

	try {
		// Delete all objects first
		const list = await client.send(new ListObjectsV2Command({ Bucket: bucketName }));
		for (const obj of list.Contents ?? []) {
			if (obj.Key) {
				await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key }));
			}
		}
		await client.send(new DeleteBucketCommand({ Bucket: bucketName }));
	} catch {
		// Bucket may not exist — ignore
	}
}

// ── Tests ────────────────────────────────────────────────────

describe.runIf(process.env['MINIO_AVAILABLE'] === 'true')('S3 Storage Adapter (MinIO)', () => {
	let testBucket: string;

	beforeAll(async () => {
		testBucket = `test-${randomUUID().slice(0, 8)}`;
		await createBucket(testBucket);
	});

	afterAll(async () => {
		await deleteBucket(testBucket);
	});

	function createAdapter(overrides: Record<string, unknown> = {}): StorageAdapter {
		return s3StorageAdapter({
			bucket: testBucket,
			region: MINIO_REGION,
			endpoint: MINIO_ENDPOINT,
			accessKeyId: MINIO_ACCESS_KEY,
			secretAccessKey: MINIO_SECRET_KEY,
			forcePathStyle: true,
			...overrides,
		});
	}

	describe('upload', () => {
		it('should upload a file and return correct StoredFile shape', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('hello s3', 'greeting.txt');

			const result = await adapter.upload(file);

			expect(result.path).toMatch(/\.txt$/);
			expect(result.filename).toMatch(/\.txt$/);
			expect(result.mimeType).toBe('text/plain');
			expect(result.size).toBe(8);
			expect(result.url).toBeDefined();
		});

		it('should use provided filename instead of UUID', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('custom name test', 'original.txt');

			const result = await adapter.upload(file, { filename: 'my-custom-name' });

			expect(result.filename).toBe('my-custom-name.txt');
			expect(result.path).toBe('my-custom-name.txt');
		});

		it('should prefix key with directory when provided', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('dir test', 'doc.txt');

			const result = await adapter.upload(file, { directory: 'uploads/docs' });

			expect(result.path).toMatch(/^uploads\/docs\//);
			expect(result.filename).toMatch(/\.txt$/);
		});

		it('should use extension from MIME type when originalName has none', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('png fake', 'noext', 'image/png');

			const result = await adapter.upload(file);

			expect(result.path).toMatch(/\.png$/);
			expect(result.filename).toMatch(/\.png$/);
		});
	});

	describe('upload ACL logic', () => {
		it('should return public URL when acl is public-read', async () => {
			const adapter = createAdapter({ acl: 'public-read' });
			const file = makeTestFile('public file');

			const result = await adapter.upload(file);

			// Public URL uses endpoint/bucket/key pattern for MinIO
			expect(result.url).toMatch(new RegExp(`^${MINIO_ENDPOINT}/${testBucket}/`));
		});

		it('should return API proxy URL when acl is private', async () => {
			const adapter = createAdapter({ acl: 'private' });
			const file = makeTestFile('private file');

			const result = await adapter.upload(file);

			expect(result.url).toMatch(/^\/api\/media\/file\//);
		});
	});

	describe('exists', () => {
		it('should return true for an existing file', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('exists test');
			const { path } = await adapter.upload(file);

			const result = await adapter.exists(path);

			expect(result).toBe(true);
		});

		it('should return false for a non-existent file', async () => {
			const adapter = createAdapter();

			const result = await adapter.exists('does-not-exist.txt');

			expect(result).toBe(false);
		});
	});

	describe('delete', () => {
		it('should delete an existing file and return true', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('delete me');
			const { path } = await adapter.upload(file);

			const deleted = await adapter.delete(path);

			expect(deleted).toBe(true);
			expect(await adapter.exists(path)).toBe(false);
		});

		it('should return true even for non-existent file (S3 DeleteObject returns 204)', async () => {
			const adapter = createAdapter();

			// S3 DeleteObject returns 204 for missing keys — our adapter
			// wraps it in try/catch and returns true on success
			const deleted = await adapter.delete('no-such-file.txt');

			expect(deleted).toBe(true);
		});
	});

	describe('getUrl', () => {
		it('should return endpoint-based URL when acl is public-read', () => {
			const adapter = createAdapter({ acl: 'public-read' });

			const url = adapter.getUrl('some/path.txt');

			expect(url).toBe(`${MINIO_ENDPOINT}/${testBucket}/some/path.txt`);
		});

		it('should return API proxy URL when acl is private', () => {
			const adapter = createAdapter({ acl: 'private' });

			const url = adapter.getUrl('some/path.txt');

			expect(url).toBe('/api/media/file/some/path.txt');
		});

		it('should use baseUrl when provided', () => {
			const adapter = createAdapter({ acl: 'public-read', baseUrl: 'https://cdn.example.com' });

			const url = adapter.getUrl('some/path.txt');

			expect(url).toBe('https://cdn.example.com/some/path.txt');
		});
	});

	describe('getSignedUrl', () => {
		it('should return a signed URL with query parameters', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('sign me');
			const { path } = await adapter.upload(file);

			const signedUrl = await adapter.getSignedUrl!(path);

			expect(signedUrl).toContain(path);
			expect(signedUrl).toContain('X-Amz-Signature');
			expect(signedUrl).toContain('X-Amz-Expires');
		});

		it('should respect custom expiry', async () => {
			const adapter = createAdapter();
			const file = makeTestFile('expiry test');
			const { path } = await adapter.upload(file);

			const signedUrl = await adapter.getSignedUrl!(path, 300);

			expect(signedUrl).toContain('X-Amz-Expires=300');
		});
	});

	describe('read', () => {
		it('should return buffer contents matching uploaded data', async () => {
			const adapter = createAdapter();
			const content = 'read me back';
			const file = makeTestFile(content);
			const { path } = await adapter.upload(file);

			const buffer = await adapter.read!(path);

			expect(buffer).not.toBeNull();
			expect(buffer!.toString()).toBe(content);
		});

		it('should return null for a non-existent file', async () => {
			const adapter = createAdapter();

			const buffer = await adapter.read!('does-not-exist.txt');

			expect(buffer).toBeNull();
		});

		it('should handle binary data correctly', async () => {
			const adapter = createAdapter();
			const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
			const file: UploadedFile = {
				originalName: 'test.png',
				mimeType: 'image/png',
				size: binaryData.length,
				buffer: binaryData,
			};
			const { path } = await adapter.upload(file);

			const buffer = await adapter.read!(path);

			expect(buffer).not.toBeNull();
			expect(Buffer.compare(buffer!, binaryData)).toBe(0);
		});
	});

	describe('lazy SDK loading', () => {
		it('should be constructable without triggering SDK load', () => {
			// This just verifies the adapter doesn't throw on construction
			const adapter = createAdapter();
			expect(adapter).toBeDefined();
			expect(typeof adapter.upload).toBe('function');
			expect(typeof adapter.delete).toBe('function');
			expect(typeof adapter.exists).toBe('function');
			expect(typeof adapter.getUrl).toBe('function');
		});
	});
});

describe.runIf(process.env['MINIO_AVAILABLE'] !== 'true')('S3 Storage Adapter (skipped)', () => {
	it.skip('requires MinIO — set MINIO_AVAILABLE=true or start MinIO via docker compose', () => {
		// S3 integration tests are skipped when MinIO is not available.
		// Run `docker compose up -d minio` to enable them.
	});
});
