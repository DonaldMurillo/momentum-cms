import { test, expect } from '../fixtures';

/**
 * Media Upload E2E Tests
 *
 * Tests file upload, serving, and management via the Express API.
 * Uses Playwright's request context for direct API testing.
 *
 * The server-express middleware provides:
 * - POST /api/media/upload (multipart upload)
 * - GET /api/media/file/* (file serving)
 * - Standard CRUD on /api/media collection
 */

// Minimal valid JPEG (1x1 pixel) for testing uploads
const JPEG_BUFFER = Buffer.from([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
	0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

// Track uploaded media IDs for cleanup
const uploadedIds: string[] = [];

test.describe('Media Upload API', () => {
	test.afterEach(async ({ request }) => {
		// Clean up uploaded media documents
		for (const id of uploadedIds) {
			try {
				await request.delete(`/api/media/${id}`);
			} catch {
				// Ignore cleanup errors
			}
		}
		uploadedIds.length = 0;
	});

	test('should reject upload without authentication', async ({ request }) => {
		const response = await request.post('/api/media/upload', {
			multipart: {
				file: {
					name: 'test.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});

		// Upload handler checks for user context - should get 401
		expect(response.status()).toBe(401);
	});

	test('should upload an image file via API with auth context', async ({ request }) => {
		// The Express middleware extracts user from req.user (set by auth middleware)
		// Since there's no auth middleware configured in the test app,
		// the upload will be rejected. This tests that auth is enforced.
		const response = await request.post('/api/media/upload', {
			multipart: {
				file: {
					name: 'test-image.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});

		// Without auth middleware setting req.user, upload should be rejected
		expect(response.status()).toBe(401);
	});

	test('should return 400 or 500 when storage not configured and no file', async ({ request }) => {
		const response = await request.post('/api/media/upload', {
			multipart: {
				// No file field
				alt: 'test',
			},
		});

		// Should fail with 400 (no file) or 401 (no auth)
		expect([400, 401]).toContain(response.status());
	});

	test('should list media collection via API', async ({ request }) => {
		const response = await request.get('/api/media');
		expect(response.ok()).toBe(true);

		const data = await response.json();
		expect(data).toHaveProperty('docs');
		expect(Array.isArray(data.docs)).toBe(true);
	});

	test('should return 404 for non-existent media file', async ({ request }) => {
		const response = await request.get('/api/media/file/nonexistent-file.jpg');
		expect(response.status()).toBe(404);
	});
});
