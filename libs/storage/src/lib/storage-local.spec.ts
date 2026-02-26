import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { localStorageAdapter } from './storage-local';
import type { UploadedFile } from '@momentumcms/core';

function createTestFile(overrides: Partial<UploadedFile> = {}): UploadedFile {
	return {
		originalName: 'test-image.jpg',
		mimeType: 'image/jpeg',
		size: 22,
		buffer: Buffer.from([
			0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
			0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
		]),
		...overrides,
	};
}

describe('localStorageAdapter', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'mcms-storage-'));
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	describe('upload', () => {
		it('should write file to disk and return StoredFile metadata', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const file = createTestFile();

			const result = await adapter.upload(file);

			expect(result.filename).toMatch(/^[0-9a-f-]+\.jpg$/);
			expect(result.mimeType).toBe('image/jpeg');
			expect(result.size).toBe(22);
			expect(result.path).toBeTruthy();
			expect(result.url).toBeTruthy();

			// File should exist on disk
			const filePath = join(tmpDir, result.path);
			expect(existsSync(filePath)).toBe(true);

			// Content should match
			const storedContent = readFileSync(filePath);
			expect(Buffer.compare(storedContent, file.buffer)).toBe(0);
		});

		it('should generate URL using baseUrl when provided', async () => {
			const adapter = localStorageAdapter({
				directory: tmpDir,
				baseUrl: 'https://cdn.example.com/files',
			});
			const result = await adapter.upload(createTestFile());

			expect(result.url).toMatch(/^https:\/\/cdn\.example\.com\/files\//);
		});

		it('should generate API URL when no baseUrl provided', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const result = await adapter.upload(createTestFile());

			expect(result.url).toMatch(/^\/api\/media\/file\//);
		});

		it('should use custom filename from options when provided', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const result = await adapter.upload(createTestFile(), { filename: 'custom-name' });

			expect(result.filename).toBe('custom-name.jpg');
		});

		it('should create subdirectory when directory option provided', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const result = await adapter.upload(createTestFile(), { directory: 'images/2024' });

			expect(result.path).toContain('images');
			expect(result.path).toContain('2024');
			const filePath = join(tmpDir, result.path);
			expect(existsSync(filePath)).toBe(true);
		});

		it('should derive extension from MIME type when originalName has none', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const file = createTestFile({ originalName: 'noext', mimeType: 'image/png' });
			const result = await adapter.upload(file);

			expect(result.filename).toMatch(/\.png$/);
		});

		it('should handle unknown MIME type gracefully (no extension)', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const file = createTestFile({
				originalName: 'noext',
				mimeType: 'application/x-custom',
			});
			const result = await adapter.upload(file);

			// UUID without extension
			expect(result.filename).toMatch(/^[0-9a-f-]+$/);
		});

		it('should create upload directory if it does not exist', async () => {
			const nonExistentDir = join(tmpDir, 'does', 'not', 'exist');
			const adapter = localStorageAdapter({ directory: nonExistentDir });
			const result = await adapter.upload(createTestFile());

			expect(existsSync(join(nonExistentDir, result.path))).toBe(true);
		});
	});

	describe('delete', () => {
		it('should delete existing file and return true', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const result = await adapter.upload(createTestFile());

			const deleted = await adapter.delete(result.path);
			expect(deleted).toBe(true);
			expect(existsSync(join(tmpDir, result.path))).toBe(false);
		});

		it('should return false for non-existent file', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const deleted = await adapter.delete('does-not-exist.jpg');
			expect(deleted).toBe(false);
		});
	});

	describe('exists', () => {
		it('should return true for existing file', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const result = await adapter.upload(createTestFile());

			expect(await adapter.exists(result.path)).toBe(true);
		});

		it('should return false for non-existent file', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			expect(await adapter.exists('nope.jpg')).toBe(false);
		});
	});

	describe('read', () => {
		it('should return buffer for existing file', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const file = createTestFile();
			const result = await adapter.upload(file);

			const readBuffer = await adapter.read?.(result.path);
			expect(readBuffer).not.toBeNull();
			expect(Buffer.compare(readBuffer, file.buffer)).toBe(0);
		});

		it('should return null for non-existent file', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			const readBuffer = await adapter.read?.('missing.jpg');
			expect(readBuffer).toBeNull();
		});
	});

	describe('getUrl', () => {
		it('should return baseUrl-based URL when configured', () => {
			const adapter = localStorageAdapter({
				directory: tmpDir,
				baseUrl: 'https://cdn.example.com/files',
			});
			expect(adapter.getUrl('test.jpg')).toBe('https://cdn.example.com/files/test.jpg');
		});

		it('should return API-based URL when no baseUrl', () => {
			const adapter = localStorageAdapter({ directory: tmpDir });
			expect(adapter.getUrl('test.jpg')).toBe('/api/media/file/test.jpg');
		});
	});

	describe('security: path traversal prevention', () => {
		it('should block path traversal via ../../../etc/passwd', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });

			await expect(adapter.exists('../../../etc/passwd')).rejects.toThrow(
				'directory traversal',
			);
		});

		it('should block path traversal in upload directory option', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });

			await expect(
				adapter.upload(createTestFile(), { directory: '../../outside' }),
			).rejects.toThrow('directory traversal');
		});

		it('should block path traversal in delete', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });

			await expect(adapter.delete('../../../etc/passwd')).rejects.toThrow(
				'directory traversal',
			);
		});

		it('should block path traversal in read', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });

			await expect(adapter.read?.('../../../etc/passwd')).rejects.toThrow(
				'directory traversal',
			);
		});
	});

	describe('security: symlink prevention', () => {
		it('should reject symlinks when checking exists', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });

			// Create a symlink inside tmpDir pointing outside
			const outsideFile = join(tmpdir(), 'mcms-outside-target.txt');
			writeFileSync(outsideFile, 'secret data');
			const symlinkPath = join(tmpDir, 'bad-symlink.txt');
			symlinkSync(outsideFile, symlinkPath);

			try {
				await expect(adapter.exists('bad-symlink.txt')).rejects.toThrow(
					'symbolic links not allowed',
				);
			} finally {
				rmSync(outsideFile, { force: true });
			}
		});

		it('should reject symlinks when reading', async () => {
			const adapter = localStorageAdapter({ directory: tmpDir });

			const outsideFile = join(tmpdir(), 'mcms-outside-read.txt');
			writeFileSync(outsideFile, 'secret read data');
			const symlinkPath = join(tmpDir, 'read-symlink.txt');
			symlinkSync(outsideFile, symlinkPath);

			try {
				await expect(adapter.read?.('read-symlink.txt')).rejects.toThrow(
					'symbolic links not allowed',
				);
			} finally {
				rmSync(outsideFile, { force: true });
			}
		});
	});
});
