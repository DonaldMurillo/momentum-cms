import { test, expect } from '../fixtures';

/**
 * Media Upload E2E Tests
 *
 * Part A: API-level tests for legacy upload endpoint (/api/media/upload).
 * Part B: Admin UI tests for upload field on Articles collection.
 * Part C: API-level tests for collection-level upload (POST /api/media with multipart).
 * Part D: Admin UI tests for media collection page (upload zone on entity form).
 *
 * Routes tested:
 * - POST /api/media/upload  (legacy multipart upload)
 * - POST /api/media          (collection-level multipart upload — Payload pattern)
 * - GET  /api/media/file/*  (file serving)
 * - Standard CRUD on /api/media collection
 * - Admin UI at /admin/collections/articles/new (upload field)
 * - Admin UI at /admin/collections/media/new    (upload collection form)
 */

// Minimal valid JPEG (1x1 pixel) — magic bytes match image/jpeg
const JPEG_BUFFER = Buffer.from([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
	0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

// Minimal valid PNG (1x1 transparent pixel)
const PNG_BUFFER = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNl7BcQAAAABJRU5ErkJggg==',
	'base64',
);

// Minimal PDF header (for MIME validation tests)
const PDF_BUFFER = Buffer.from('%PDF-1.4 minimal pdf content', 'utf-8');

// EXE magic bytes (MZ header) — for magic-byte spoofing security test
const EXE_BUFFER = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

// ============================================================
// Part A: API-Level Tests
// ============================================================

test.describe('Media Upload API', () => {
	const uploadedMediaIds: string[] = [];

	test.afterEach(async ({ authenticatedPage }) => {
		for (const id of uploadedMediaIds) {
			const resp = await authenticatedPage.request.delete(`/api/media/${id}`);
			if (!resp.ok()) {
				console.warn(`Cleanup: failed to delete media ${id}: ${resp.status()}`);
			}
		}
		uploadedMediaIds.length = 0;
	});

	test.describe('Authentication', () => {
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

			expect(response.status()).toBe(401);
		});
	});

	test.describe('Successful Upload', () => {
		test('should upload a JPEG file and return 201 with media document', async ({
			authenticatedPage,
		}) => {
			const response = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					file: {
						name: 'test-image.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});

			expect(response.status()).toBe(201);

			const data = await response.json();
			expect(data.doc).toBeDefined();
			expect(data.doc.id).toBeDefined();
			expect(data.doc.filename).toBe('test-image.jpg');
			expect(data.doc.mimeType).toBe('image/jpeg');
			expect(data.doc.path).toBeDefined();
			expect(data.doc.url).toBeDefined();

			uploadedMediaIds.push(data.doc.id);
		});

		test('should upload a PNG file', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					file: {
						name: 'test-image.png',
						mimeType: 'image/png',
						buffer: PNG_BUFFER,
					},
				},
			});

			expect(response.status()).toBe(201);
			const data = await response.json();
			expect(data.doc.mimeType).toBe('image/png');
			uploadedMediaIds.push(data.doc.id);
		});

		test('should include alt text when provided', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					file: {
						name: 'alt-test.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
					alt: 'A beautiful landscape',
				},
			});

			expect(response.status()).toBe(201);
			const data = await response.json();
			expect(data.doc.alt).toBe('A beautiful landscape');
			uploadedMediaIds.push(data.doc.id);
		});
	});

	test.describe('File Serving', () => {
		test('should serve uploaded file via GET /api/media/file/{path}', async ({
			authenticatedPage,
			request,
		}) => {
			// Upload a file (authenticated)
			const uploadResponse = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					file: {
						name: 'serve-test.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResponse.status()).toBe(201);
			const { doc } = await uploadResponse.json();
			uploadedMediaIds.push(doc.id);

			// Serve file (unauthenticated — file serving is public)
			const fileResponse = await request.get(`/api/media/file/${doc.path}`);
			expect(fileResponse.ok()).toBe(true);

			const contentType = fileResponse.headers()['content-type'];
			expect(contentType).toBe('image/jpeg');

			const cacheControl = fileResponse.headers()['cache-control'];
			expect(cacheControl).toContain('public');

			// Content should match original
			const servedBuffer = await fileResponse.body();
			expect(Buffer.compare(servedBuffer, JPEG_BUFFER)).toBe(0);
		});

		test('should return 404 for non-existent file', async ({ request }) => {
			const response = await request.get('/api/media/file/nonexistent-file.jpg');
			expect(response.status()).toBe(404);
		});

		test('should reject directory traversal in file path', async ({ request }) => {
			// URL-encode slashes to prevent HTTP client from normalizing ../ before sending
			const response = await request.get('/api/media/file/..%2F..%2F..%2Fetc%2Fpasswd');
			expect(response.status()).toBe(403);
		});
	});

	test.describe('Validation', () => {
		test('should reject upload when no file field provided', async ({ authenticatedPage }) => {
			const response = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					alt: 'no file here',
				},
			});
			expect(response.status()).toBe(400);
		});

		test('should reject file with spoofed MIME type (EXE disguised as JPEG)', async ({
			authenticatedPage,
		}) => {
			const response = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					file: {
						name: 'trojan.jpg',
						mimeType: 'image/jpeg',
						buffer: EXE_BUFFER,
					},
				},
			});
			expect(response.status()).toBe(400);
		});
	});

	test.describe('Media Collection CRUD', () => {
		test('should list media documents via GET /api/media', async ({ request }) => {
			const response = await request.get('/api/media');
			expect(response.ok()).toBe(true);

			const data = await response.json();
			expect(data).toHaveProperty('docs');
			expect(Array.isArray(data.docs)).toBe(true);
		});

		test('should delete a media document', async ({ authenticatedPage }) => {
			// Upload first
			const uploadResponse = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					file: {
						name: 'delete-test.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResponse.status()).toBe(201);
			const { doc } = await uploadResponse.json();

			// Delete the document
			const deleteResponse = await authenticatedPage.request.delete(`/api/media/${doc.id}`);
			expect(deleteResponse.ok()).toBe(true);

			// Verify it's gone
			const getResponse = await authenticatedPage.request.get(`/api/media/${doc.id}`);
			expect(getResponse.status()).toBe(404);
		});

		test('should find uploaded media document by id', async ({ authenticatedPage }) => {
			const uploadResponse = await authenticatedPage.request.post('/api/media/upload', {
				multipart: {
					file: {
						name: 'findbyid-test.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResponse.status()).toBe(201);
			const { doc } = await uploadResponse.json();
			uploadedMediaIds.push(doc.id);

			const getResponse = await authenticatedPage.request.get(`/api/media/${doc.id}`);
			expect(getResponse.ok()).toBe(true);

			const data = await getResponse.json();
			expect(data.doc.filename).toBe('findbyid-test.jpg');
		});
	});
});

// ============================================================
// Part B: Admin UI Upload Field Tests
// ============================================================

test.describe('Upload Field UI - Articles', () => {
	const createdArticleIds: string[] = [];
	const createdMediaIds: string[] = [];

	test.afterEach(async ({ authenticatedPage }) => {
		for (const id of createdArticleIds) {
			const resp = await authenticatedPage.request.delete(`/api/articles/${id}`);
			if (!resp.ok()) {
				console.warn(`Cleanup: failed to delete article ${id}: ${resp.status()}`);
			}
		}
		createdArticleIds.length = 0;

		for (const id of createdMediaIds) {
			const resp = await authenticatedPage.request.delete(`/api/media/${id}`);
			if (!resp.ok()) {
				console.warn(`Cleanup: failed to delete media ${id}: ${resp.status()}`);
			}
		}
		createdMediaIds.length = 0;
	});

	test('should display upload field with drop zone in article create form', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for form to hydrate
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Upload field should show the drop zone (scoped to the upload renderer)
		const uploadField = authenticatedPage.locator('mcms-upload-field-renderer');
		await expect(uploadField).toBeVisible();
		await expect(uploadField.getByText('Drag & drop or click to upload')).toBeVisible();

		// Should show MIME type hint
		await expect(uploadField.getByText(/Allowed: Images/)).toBeVisible();

		// Should show max size hint
		await expect(uploadField.getByText(/Max size: 5.0 MB/)).toBeVisible();
	});

	test('should upload file via file picker and show preview', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Use filechooser event pattern — click the drop zone, then set files via the file chooser
		const uploadField = authenticatedPage.locator('mcms-upload-field-renderer');
		const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
		await uploadField.getByText('Drag & drop or click to upload').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'test-cover.jpg',
			mimeType: 'image/jpeg',
			buffer: JPEG_BUFFER,
		});

		// After upload completes, preview should show the filename
		await expect(uploadField.getByText('test-cover.jpg')).toBeVisible({ timeout: 15000 });
	});

	test('should create article with cover image via form submission', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Use unique title to avoid collisions with parallel test runs
		const uniqueTitle = `Article With Cover ${Date.now()}`;

		// Fill required title field
		const titleInput = authenticatedPage.getByLabel('Title');
		await titleInput.click();
		await titleInput.pressSequentially(uniqueTitle, { delay: 20 });

		// Upload cover image via filechooser
		const uploadField = authenticatedPage.locator('mcms-upload-field-renderer');
		const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
		await uploadField.getByText('Drag & drop or click to upload').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'cover-photo.jpg',
			mimeType: 'image/jpeg',
			buffer: JPEG_BUFFER,
		});

		// Wait for upload to complete (preview shows filename)
		await expect(uploadField.getByText('cover-photo.jpg')).toBeVisible({ timeout: 15000 });

		// Submit form
		await authenticatedPage.getByRole('button', { name: 'Create', exact: true }).click();

		// Should navigate away from /new on success
		await expect(authenticatedPage).not.toHaveURL(/\/new$/, { timeout: 15000 });

		// Verify via API — query by unique title to avoid position-based selection
		const response = await authenticatedPage.request.get(
			`/api/articles?where[title][equals]=${encodeURIComponent(uniqueTitle)}`,
		);
		expect(response.ok()).toBe(true);
		const data = await response.json();
		expect(data.docs.length).toBeGreaterThanOrEqual(1);
		const article = data.docs[0];
		expect(article.title).toBe(uniqueTitle);
		expect(article.coverImage).toBeDefined();

		createdArticleIds.push(article.id);
		// Also track the media for cleanup
		if (typeof article.coverImage === 'string') {
			createdMediaIds.push(article.coverImage);
		} else if (article.coverImage?.id) {
			createdMediaIds.push(article.coverImage.id);
		}
	});

	test('should remove uploaded media via Remove button', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Upload a file via filechooser
		const uploadField = authenticatedPage.locator('mcms-upload-field-renderer');
		const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
		await uploadField.getByText('Drag & drop or click to upload').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'remove-test.jpg',
			mimeType: 'image/jpeg',
			buffer: JPEG_BUFFER,
		});

		// Wait for preview
		await expect(uploadField.getByText('remove-test.jpg')).toBeVisible({ timeout: 15000 });

		// Click Remove button
		await uploadField.getByRole('button', { name: 'Remove' }).click();

		// Drop zone should reappear
		await expect(uploadField.getByText('Drag & drop or click to upload')).toBeVisible();
	});

	test('should show error when uploading non-image file to image-only field', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/articles/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Try uploading a PDF to an image-only field via filechooser
		const uploadField = authenticatedPage.locator('mcms-upload-field-renderer');
		const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
		await uploadField.getByText('Drag & drop or click to upload').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'document.pdf',
			mimeType: 'application/pdf',
			buffer: PDF_BUFFER,
		});

		// Should show client-side MIME validation error
		await expect(uploadField.getByText(/not allowed/)).toBeVisible({ timeout: 5000 });
	});

	test('should open media picker dialog via Select from library button', async ({
		authenticatedPage,
	}) => {
		// First upload a file via API so there's something in the media library
		const uploadResp = await authenticatedPage.request.post('/api/media/upload', {
			multipart: {
				file: {
					name: 'library-img.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc: uploadedDoc } = await uploadResp.json();
		createdMediaIds.push(uploadedDoc.id);

		// Navigate to article create form
		await authenticatedPage.goto('/admin/collections/articles/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Click "Select from library" button
		const uploadField = authenticatedPage.locator('mcms-upload-field-renderer');
		await uploadField.getByRole('button', { name: /Select from library/ }).click();

		// Dialog should open
		const dialog = authenticatedPage.locator('[role="dialog"]');
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Should show the uploaded media item
		await expect(dialog.getByText('library-img.jpg')).toBeVisible({ timeout: 5000 });
	});

	test('should show uploaded cover image when editing an existing article', async ({
		authenticatedPage,
	}) => {
		// Create media via API
		const uploadResp = await authenticatedPage.request.post('/api/media/upload', {
			multipart: {
				file: {
					name: 'edit-view.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc: mediaDoc } = await uploadResp.json();
		createdMediaIds.push(mediaDoc.id);

		// Create article with coverImage via API
		const createResp = await authenticatedPage.request.post('/api/articles', {
			data: { title: 'Edit View Test', coverImage: mediaDoc.id },
		});
		expect(createResp.ok()).toBe(true);
		const { doc: article } = await createResp.json();
		createdArticleIds.push(article.id);

		// Navigate to edit page
		await authenticatedPage.goto(`/admin/collections/articles/${article.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// The upload field should resolve the media ID and show the real filename
		const uploadField = authenticatedPage.locator('mcms-upload-field-renderer');
		await expect(uploadField.getByText('edit-view.jpg')).toBeVisible({ timeout: 15000 });

		// Change and Remove buttons prove the preview state loaded correctly
		await expect(uploadField.getByRole('button', { name: 'Change' })).toBeVisible();
		await expect(uploadField.getByRole('button', { name: 'Remove' })).toBeVisible();
	});

	test('should show media filename (not UUID) on article view page', async ({
		authenticatedPage,
	}) => {
		// Create media via API
		const uploadResp = await authenticatedPage.request.post('/api/media/upload', {
			multipart: {
				file: {
					name: 'view-page-test.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc: mediaDoc } = await uploadResp.json();
		createdMediaIds.push(mediaDoc.id);

		// Create article with coverImage via API
		const createResp = await authenticatedPage.request.post('/api/articles', {
			data: { title: 'View Page Article', coverImage: mediaDoc.id },
		});
		expect(createResp.ok()).toBe(true);
		const { doc: article } = await createResp.json();
		createdArticleIds.push(article.id);

		// Navigate to the VIEW page (not edit)
		await authenticatedPage.goto(`/admin/collections/articles/${article.id}`);
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for entity view to load
		await expect(
			authenticatedPage.getByRole('heading', { name: 'View Page Article' }),
		).toBeVisible({ timeout: 10000 });

		// The cover image field should show the media filename, NOT the raw UUID
		await expect(authenticatedPage.getByText('view-page-test.jpg')).toBeVisible({
			timeout: 10000,
		});
		// The raw UUID should NOT be displayed as the field value
		await expect(authenticatedPage.getByText(mediaDoc.id)).not.toBeVisible();
	});
});

// ============================================================
// Part C: Collection-Level Upload API (POST /api/media with multipart)
// ============================================================

test.describe('Collection-Level Upload API (POST /api/media)', () => {
	const uploadedMediaIds: string[] = [];

	test.afterEach(async ({ authenticatedPage }) => {
		for (const id of uploadedMediaIds) {
			const resp = await authenticatedPage.request.delete(`/api/media/${id}`);
			if (!resp.ok()) {
				console.warn(`Cleanup: failed to delete media ${id}: ${resp.status()}`);
			}
		}
		uploadedMediaIds.length = 0;
	});

	test('should upload JPEG via POST /api/media and return 201 with auto-populated metadata', async ({
		authenticatedPage,
	}) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'collection-upload.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});

		expect(response.status()).toBe(201);

		const data = await response.json();
		expect(data.doc).toBeDefined();
		expect(data.doc.id).toBeDefined();
		expect(data.doc.filename).toBe('collection-upload.jpg');
		expect(data.doc.mimeType).toBe('image/jpeg');
		expect(typeof data.doc.filesize).toBe('number');
		expect(data.doc.path).toBeDefined();
		expect(data.doc.url).toBeDefined();

		uploadedMediaIds.push(data.doc.id);
	});

	test('should reject collection upload without authentication', async ({ request }) => {
		const response = await request.post('/api/media', {
			multipart: {
				file: {
					name: 'unauth.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});

		expect(response.status()).toBe(401);
	});

	test('should reject collection upload without file', async ({ authenticatedPage }) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				alt: 'no file here',
			},
		});

		expect(response.status()).toBe(400);
	});

	test('should reject collection upload with spoofed MIME type', async ({
		authenticatedPage,
	}) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'fake.jpg',
					mimeType: 'image/jpeg',
					buffer: EXE_BUFFER,
				},
			},
		});

		expect(response.status()).toBe(400);
	});

	test('should preserve extra fields (alt text) in collection upload', async ({
		authenticatedPage,
	}) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'alt-collection.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
				alt: 'Collection level alt text',
			},
		});

		expect(response.status()).toBe(201);
		const data = await response.json();
		expect(data.doc.alt).toBe('Collection level alt text');
		expect(data.doc.filename).toBe('alt-collection.jpg');

		uploadedMediaIds.push(data.doc.id);
	});

	test('should upload via collection endpoint then serve file via GET /api/media/file/{path}', async ({
		authenticatedPage,
		request,
	}) => {
		// Upload via collection endpoint
		const uploadResponse = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'serve-collection.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});
		expect(uploadResponse.status()).toBe(201);
		const { doc } = await uploadResponse.json();
		uploadedMediaIds.push(doc.id);

		// Serve file (public)
		const fileResponse = await request.get(`/api/media/file/${doc.path}`);
		expect(fileResponse.ok()).toBe(true);

		const contentType = fileResponse.headers()['content-type'];
		expect(contentType).toBe('image/jpeg');

		const servedBuffer = await fileResponse.body();
		expect(Buffer.compare(servedBuffer, JPEG_BUFFER)).toBe(0);
	});

	test('should upload PNG via collection endpoint', async ({ authenticatedPage }) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'collection-png.png',
					mimeType: 'image/png',
					buffer: PNG_BUFFER,
				},
			},
		});

		expect(response.status()).toBe(201);
		const data = await response.json();
		expect(data.doc.mimeType).toBe('image/png');
		expect(data.doc.filename).toBe('collection-png.png');

		uploadedMediaIds.push(data.doc.id);
	});

	test('should delete media uploaded via collection endpoint', async ({
		authenticatedPage,
	}) => {
		// Upload
		const uploadResponse = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'delete-collection.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});
		expect(uploadResponse.status()).toBe(201);
		const { doc } = await uploadResponse.json();

		// Delete
		const deleteResponse = await authenticatedPage.request.delete(`/api/media/${doc.id}`);
		expect(deleteResponse.ok()).toBe(true);

		// Verify gone
		const getResponse = await authenticatedPage.request.get(`/api/media/${doc.id}`);
		expect(getResponse.status()).toBe(404);
	});

	test('legacy POST /api/media/upload still works alongside collection endpoint', async ({
		authenticatedPage,
	}) => {
		const response = await authenticatedPage.request.post('/api/media/upload', {
			multipart: {
				file: {
					name: 'legacy-compat.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});

		expect(response.status()).toBe(201);
		const data = await response.json();
		expect(data.doc.filename).toBe('legacy-compat.jpg');

		uploadedMediaIds.push(data.doc.id);
	});
});

// ============================================================
// Part D: Admin UI — Media Collection Upload Zone
// ============================================================

test.describe('Media Collection Upload Zone UI', () => {
	const uploadedMediaIds: string[] = [];

	test.afterEach(async ({ authenticatedPage }) => {
		for (const id of uploadedMediaIds) {
			const resp = await authenticatedPage.request.delete(`/api/media/${id}`);
			if (!resp.ok()) {
				console.warn(`Cleanup: failed to delete media ${id}: ${resp.status()}`);
			}
		}
		uploadedMediaIds.length = 0;
	});

	test('should display upload zone on media collection create page', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/media/new');
		await authenticatedPage.waitForLoadState('domcontentloaded');

		// Wait for form to hydrate
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Upload zone should be visible above form fields
		const uploadZone = authenticatedPage.locator('mcms-collection-upload-zone');
		await expect(uploadZone).toBeVisible();
		await expect(uploadZone.getByText('Drag & drop or click to upload')).toBeVisible();

		// Should show MIME type hints from media collection config
		await expect(uploadZone.getByText(/Allowed:/)).toBeVisible();
	});

	test('should auto-populate metadata fields when file is selected', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/media/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Select file via filechooser — click the drop zone, then set files
		const uploadZone = authenticatedPage.locator('mcms-collection-upload-zone');
		const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
		await uploadZone.getByText('Drag & drop or click to upload').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'auto-populate.jpg',
			mimeType: 'image/jpeg',
			buffer: JPEG_BUFFER,
		});

		// File preview should appear in the upload zone
		await expect(uploadZone.getByText('auto-populate.jpg')).toBeVisible({ timeout: 5000 });

		// Metadata fields should be auto-populated
		const filenameInput = authenticatedPage.getByLabel('Filename');
		await expect(filenameInput).toHaveValue('auto-populate.jpg');

		const mimeTypeInput = authenticatedPage.getByLabel('MIME Type');
		await expect(mimeTypeInput).toHaveValue('image/jpeg');
	});

	test('should submit media form with file and create document', async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto('/admin/collections/media/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Select file via filechooser
		const uploadZone = authenticatedPage.locator('mcms-collection-upload-zone');
		const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
		await uploadZone.getByText('Drag & drop or click to upload').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'form-submit.jpg',
			mimeType: 'image/jpeg',
			buffer: JPEG_BUFFER,
		});

		// Wait for file preview
		await expect(uploadZone.getByText('form-submit.jpg')).toBeVisible({ timeout: 5000 });

		// Fill alt text
		const altInput = authenticatedPage.getByLabel('Alt Text');
		await altInput.click();
		await altInput.pressSequentially('Test alt text', { delay: 20 });

		// Submit form
		await authenticatedPage.getByRole('button', { name: 'Create', exact: true }).click();

		// Should navigate away from /new on success
		await expect(authenticatedPage).not.toHaveURL(/\/new$/, { timeout: 15000 });

		// Verify via API
		const response = await authenticatedPage.request.get(
			`/api/media?where[filename][equals]=${encodeURIComponent('form-submit.jpg')}`,
		);
		expect(response.ok()).toBe(true);
		const data = await response.json();
		expect(data.docs.length).toBeGreaterThanOrEqual(1);
		const mediaDoc = data.docs[0];
		expect(mediaDoc.filename).toBe('form-submit.jpg');
		expect(mediaDoc.mimeType).toBe('image/jpeg');
		expect(mediaDoc.alt).toBe('Test alt text');
		expect(mediaDoc.path).toBeDefined();

		uploadedMediaIds.push(mediaDoc.id);
	});

	test('should remove selected file from upload zone', async ({ authenticatedPage }) => {
		await authenticatedPage.goto('/admin/collections/media/new');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Create', exact: true }),
		).toBeVisible();

		// Select file via filechooser
		const uploadZone = authenticatedPage.locator('mcms-collection-upload-zone');
		const fileChooserPromise = authenticatedPage.waitForEvent('filechooser');
		await uploadZone.getByText('Drag & drop or click to upload').click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'remove-zone.jpg',
			mimeType: 'image/jpeg',
			buffer: JPEG_BUFFER,
		});

		// Wait for file preview
		await expect(uploadZone.getByText('remove-zone.jpg')).toBeVisible({ timeout: 5000 });

		// Click remove button
		await uploadZone.getByRole('button', { name: /Remove/ }).click();

		// Drop zone should reappear
		await expect(uploadZone.getByText('Drag & drop or click to upload')).toBeVisible();
	});

	test('should replace file on existing media document via PATCH with multipart', async ({
		authenticatedPage,
	}) => {
		// Upload initial media via API
		const uploadResp = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'patch-original.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
				alt: 'Original alt',
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc: originalDoc } = await uploadResp.json();
		uploadedMediaIds.push(originalDoc.id);

		// PATCH with new file (authenticated)
		const patchResp = await authenticatedPage.request.patch(`/api/media/${originalDoc.id}`, {
			multipart: {
				file: {
					name: 'patch-replaced.png',
					mimeType: 'image/png',
					buffer: PNG_BUFFER,
				},
				alt: 'Updated alt',
			},
		});
		expect(patchResp.ok()).toBe(true);

		const { doc: updatedDoc } = await patchResp.json();
		expect(updatedDoc.filename).toBe('patch-replaced.png');
		expect(updatedDoc.mimeType).toBe('image/png');
		expect(updatedDoc.alt).toBe('Updated alt');
	});

	test('should show existing file preview when editing a media document', async ({
		authenticatedPage,
	}) => {
		// Upload a media document via API
		const uploadResp = await authenticatedPage.request.post('/api/media/upload', {
			multipart: {
				file: {
					name: 'edit-media-preview.jpg',
					mimeType: 'image/jpeg',
					buffer: JPEG_BUFFER,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc: mediaDoc } = await uploadResp.json();
		uploadedMediaIds.push(mediaDoc.id);

		// Navigate to edit page for this media document
		await authenticatedPage.goto(`/admin/collections/media/${mediaDoc.id}/edit`);
		await authenticatedPage.waitForLoadState('domcontentloaded');
		await expect(
			authenticatedPage.getByRole('button', { name: 'Save Changes', exact: true }),
		).toBeVisible();

		// The upload zone should show the existing file preview, not the drop zone
		const uploadZone = authenticatedPage.locator('mcms-collection-upload-zone');
		await expect(uploadZone.getByText('edit-media-preview.jpg')).toBeVisible({ timeout: 10000 });

		// Drop zone ("Drag & drop") should NOT be visible when existing file is shown
		await expect(uploadZone.getByText('Drag & drop or click to upload')).not.toBeVisible();
	});
});

// ============================================================
// Part E: PATCH Upload Security & Validation
// ============================================================

test.describe('PATCH Upload Security', () => {
	const uploadedMediaIds: string[] = [];

	test.afterEach(async ({ authenticatedPage }) => {
		for (const id of uploadedMediaIds) {
			const resp = await authenticatedPage.request.delete(`/api/media/${id}`);
			if (!resp.ok()) {
				console.warn(`Cleanup: failed to delete media ${id}: ${resp.status()}`);
			}
		}
		uploadedMediaIds.length = 0;
	});

	test.describe('Authentication', () => {
		test('should reject PATCH upload without authentication', async ({
			request,
			authenticatedPage,
		}) => {
			// First create a media doc to PATCH against (authenticated)
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'patch-auth-test.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();
			uploadedMediaIds.push(doc.id);

			// Attempt unauthenticated PATCH with file replacement
			const patchResp = await request.patch(`/api/media/${doc.id}`, {
				multipart: {
					file: {
						name: 'unauthenticated-replace.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});

			// Must reject with 401, not allow file storage
			expect(patchResp.status()).toBe(401);
		});

		test('should reject unauthenticated PATCH even without file (JSON update)', async ({
			request,
			authenticatedPage,
		}) => {
			// Create a media doc
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'patch-json-auth.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();
			uploadedMediaIds.push(doc.id);

			// Unauthenticated PATCH without file (standard JSON update path)
			const patchResp = await request.patch(`/api/media/${doc.id}`, {
				data: { alt: 'sneaky update' },
			});

			// Should also reject — consistent auth enforcement
			expect(patchResp.status()).toBe(401);
		});
	});

	test.describe('MIME Type Validation', () => {
		test('should reject PATCH upload with disallowed claimed MIME type', async ({
			authenticatedPage,
		}) => {
			// Create a media doc
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'mime-validate-test.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();
			uploadedMediaIds.push(doc.id);

			// PATCH with a file claiming text/plain MIME type (not in media allowed list)
			// Media collection allows: image/*, application/pdf, video/*, audio/*
			const textBuffer = Buffer.from('This is plain text content', 'utf-8');
			const patchResp = await authenticatedPage.request.patch(`/api/media/${doc.id}`, {
				multipart: {
					file: {
						name: 'sneaky.txt',
						mimeType: 'text/plain',
						buffer: textBuffer,
					},
				},
			});

			// Must reject with 400 for disallowed MIME type
			expect(patchResp.status()).toBe(400);
			const data = await patchResp.json();
			expect(data.error).toContain('not allowed');
		});

		test('should reject PATCH upload with spoofed MIME type (EXE as JPEG)', async ({
			authenticatedPage,
		}) => {
			// Create a media doc
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'spoof-patch-test.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();
			uploadedMediaIds.push(doc.id);

			// PATCH with EXE disguised as JPEG
			const patchResp = await authenticatedPage.request.patch(`/api/media/${doc.id}`, {
				multipart: {
					file: {
						name: 'trojan.jpg',
						mimeType: 'image/jpeg',
						buffer: EXE_BUFFER,
					},
				},
			});

			// Must reject — magic bytes don't match JPEG
			expect(patchResp.status()).toBe(400);
		});

		test('should accept PATCH upload with valid MIME type and matching content', async ({
			authenticatedPage,
		}) => {
			// Create a media doc
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'valid-patch.jpg',
						mimeType: 'image/jpeg',
						buffer: JPEG_BUFFER,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();
			uploadedMediaIds.push(doc.id);

			// PATCH with valid PNG replacement
			const patchResp = await authenticatedPage.request.patch(`/api/media/${doc.id}`, {
				multipart: {
					file: {
						name: 'valid-replacement.png',
						mimeType: 'image/png',
						buffer: PNG_BUFFER,
					},
					alt: 'Updated via valid PATCH',
				},
			});

			expect(patchResp.ok()).toBe(true);
			const { doc: updated } = await patchResp.json();
			expect(updated.filename).toBe('valid-replacement.png');
			expect(updated.mimeType).toBe('image/png');
			expect(updated.alt).toBe('Updated via valid PATCH');
		});
	});
});
