import { test, expect } from '../fixtures';

/**
 * Image Processing E2E Tests
 *
 * Tests the image processing plugin features:
 * - Dimension auto-population on upload
 * - Image size variant generation (thumbnail, medium)
 * - Focal point persistence and re-processing
 * - Admin UI: dimensions visible, focal point picker
 * - Security: non-image rejection, auth enforcement, path traversal
 *
 * Requires:
 * - imagePlugin() configured in momentum.config.ts
 * - MediaCollection with imageSizes: [{ name: 'thumbnail', width: 150, height: 150, fit: 'cover' }, { name: 'medium', width: 800 }]
 */

// Valid 10x10 red PNG (generated via @napi-rs/image, valid CRC)
const PROCESSABLE_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR4nGP4z8DwnxjMMKrwP12DBwCSw8c5lI9cnwAAAABJRU5ErkJggg==',
	'base64',
);

// Minimal PDF header (for non-image test)
const PDF_BUFFER = Buffer.from('%PDF-1.4 minimal pdf content', 'utf-8');

// ============================================================
// Part A: API-Level — Image Dimensions Auto-Population
// ============================================================

test.describe('Image Dimensions API', { tag: ['@media', '@image-processing', '@api'] }, () => {
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

	test('should auto-populate width and height for uploaded PNG', async ({ authenticatedPage }) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'dimensions-test.png',
					mimeType: 'image/png',
					buffer: PROCESSABLE_PNG,
				},
			},
		});

		expect(response.status()).toBe(201);
		const data = await response.json();
		expect(data.doc.width).toBe(10);
		expect(data.doc.height).toBe(10);

		uploadedMediaIds.push(data.doc.id);
	});

	test('should persist dimensions in database (GET by ID)', async ({ authenticatedPage }) => {
		const uploadResp = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'persist-dims.png',
					mimeType: 'image/png',
					buffer: PROCESSABLE_PNG,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc: uploadDoc } = await uploadResp.json();
		uploadedMediaIds.push(uploadDoc.id);

		// Fetch via GET to confirm persistence
		const getResp = await authenticatedPage.request.get(`/api/media/${uploadDoc.id}`);
		expect(getResp.ok()).toBe(true);
		const { doc } = await getResp.json();
		// GET response may return numbers as strings due to DB serialization
		expect(Number(doc.width)).toBe(10);
		expect(Number(doc.height)).toBe(10);
	});

	test('should not populate dimensions for non-image uploads', async ({ authenticatedPage }) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'document.pdf',
					mimeType: 'application/pdf',
					buffer: PDF_BUFFER,
				},
			},
		});

		expect(response.status()).toBe(201);
		const data = await response.json();
		// PDF should not have width/height populated
		expect(data.doc.width).toBeFalsy();
		expect(data.doc.height).toBeFalsy();

		uploadedMediaIds.push(data.doc.id);
	});
});

// ============================================================
// Part B: API-Level — Image Size Variant Generation
// ============================================================

test.describe('Image Size Variants API', { tag: ['@media', '@image-processing', '@api'] }, () => {
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

	test('should generate sizes object with thumbnail and medium variants', async ({
		authenticatedPage,
	}) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'variants-test.png',
					mimeType: 'image/png',
					buffer: PROCESSABLE_PNG,
				},
			},
		});

		expect(response.status()).toBe(201);
		const data = await response.json();

		// Should have sizes object
		expect(data.doc.sizes).toBeDefined();
		expect(data.doc.sizes.thumbnail).toBeDefined();
		expect(data.doc.sizes.medium).toBeDefined();

		// Thumbnail should have required metadata
		const thumb = data.doc.sizes.thumbnail;
		expect(thumb.url).toBeDefined();
		expect(thumb.path).toBeDefined();
		expect(thumb.width).toBeGreaterThan(0);
		expect(thumb.height).toBeGreaterThan(0);
		expect(thumb.mimeType).toBeDefined();
		expect(thumb.filesize).toBeGreaterThan(0);

		// Medium should have required metadata
		const medium = data.doc.sizes.medium;
		expect(medium.url).toBeDefined();
		expect(medium.path).toBeDefined();
		expect(medium.width).toBeGreaterThan(0);
		expect(medium.height).toBeGreaterThan(0);

		uploadedMediaIds.push(data.doc.id);
	});

	test('should serve thumbnail variant via GET', async ({ authenticatedPage, request }) => {
		const uploadResp = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'serve-thumb.png',
					mimeType: 'image/png',
					buffer: PROCESSABLE_PNG,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc } = await uploadResp.json();
		uploadedMediaIds.push(doc.id);

		// Serve thumbnail via its URL — assert sizes exist (don't silently skip)
		expect(doc.sizes?.thumbnail?.path).toBeTruthy();
		const fileResp = await request.get(`/api/media/file/${doc.sizes.thumbnail.path}`);
		expect(fileResp.ok()).toBe(true);
		const contentType = fileResp.headers()['content-type'];
		expect(contentType).toContain('image/');
	});

	test('should not generate sizes for non-image uploads', async ({ authenticatedPage }) => {
		const response = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'no-sizes.pdf',
					mimeType: 'application/pdf',
					buffer: PDF_BUFFER,
				},
			},
		});

		expect(response.status()).toBe(201);
		const data = await response.json();
		// Non-image should not have sizes populated
		expect(data.doc.sizes).toBeFalsy();

		uploadedMediaIds.push(data.doc.id);
	});
});

// ============================================================
// Part C: API-Level — Focal Point Persistence
// ============================================================

test.describe('Focal Point API', { tag: ['@media', '@image-processing', '@api'] }, () => {
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

	test('should persist focal point when set via PATCH', async ({ authenticatedPage }) => {
		// Upload image
		const uploadResp = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'focal-test.png',
					mimeType: 'image/png',
					buffer: PROCESSABLE_PNG,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc } = await uploadResp.json();
		uploadedMediaIds.push(doc.id);

		// Set focal point via PATCH
		const patchResp = await authenticatedPage.request.patch(`/api/media/${doc.id}`, {
			data: { focalPoint: { x: 0.8, y: 0.2 } },
		});
		expect(patchResp.ok()).toBe(true);

		// Verify via GET
		const getResp = await authenticatedPage.request.get(`/api/media/${doc.id}`);
		expect(getResp.ok()).toBe(true);
		const { doc: fetched } = await getResp.json();
		expect(fetched.focalPoint).toBeDefined();
		expect(fetched.focalPoint.x).toBeCloseTo(0.8);
		expect(fetched.focalPoint.y).toBeCloseTo(0.2);
	});

	test('should not error when patching with same focal point', async ({ authenticatedPage }) => {
		// Upload image
		const uploadResp = await authenticatedPage.request.post('/api/media', {
			multipart: {
				file: {
					name: 'focal-noop.png',
					mimeType: 'image/png',
					buffer: PROCESSABLE_PNG,
				},
			},
		});
		expect(uploadResp.status()).toBe(201);
		const { doc } = await uploadResp.json();
		uploadedMediaIds.push(doc.id);

		// Set focal point
		await authenticatedPage.request.patch(`/api/media/${doc.id}`, {
			data: { focalPoint: { x: 0.5, y: 0.5 } },
		});

		// Patch again with same value — should not error
		const patchResp = await authenticatedPage.request.patch(`/api/media/${doc.id}`, {
			data: { focalPoint: { x: 0.5, y: 0.5 } },
		});
		expect(patchResp.ok()).toBe(true);
	});
});

// ============================================================
// Part D: Admin UI — Dimensions Visible After Upload
// ============================================================

test.describe(
	'Image Dimensions Admin UI',
	{ tag: ['@media', '@image-processing', '@admin'] },
	() => {
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

		test('should show dimensions in media edit dialog after upload', async ({
			authenticatedPage,
		}) => {
			// Upload image via API
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'dims-ui-test.png',
						mimeType: 'image/png',
						buffer: PROCESSABLE_PNG,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();
			uploadedMediaIds.push(doc.id);

			// Navigate to media library
			await authenticatedPage.goto('/admin/media');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Wait for the uploaded media item to appear in the grid
			const cardContainer = authenticatedPage.locator('.group').filter({
				has: authenticatedPage.getByLabel(`View ${doc.filename}`),
			});
			await expect(cardContainer).toBeVisible({ timeout: 10000 });

			// Hover over the media card to reveal edit button, then click it
			await cardContainer.hover();
			await cardContainer.getByLabel('Edit file details').click();

			// Dialog opens — verify dimensions are displayed
			await expect(
				authenticatedPage.getByRole('button', { name: 'Save Changes', exact: true }),
			).toBeVisible({ timeout: 10000 });

			// Dialog shows "Dimensions: 10 x 10"
			await expect(authenticatedPage.getByText('Dimensions: 10 x 10')).toBeVisible();
		});
	},
);

// ============================================================
// Part E: Admin UI — Focal Point Picker
// ============================================================

test.describe(
	'Focal Point Picker Admin UI',
	{ tag: ['@media', '@image-processing', '@admin'] },
	() => {
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

		test('should show focal point picker in media edit dialog for image', async ({
			authenticatedPage,
		}) => {
			// Upload image via API
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'focal-picker-test.png',
						mimeType: 'image/png',
						buffer: PROCESSABLE_PNG,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();
			uploadedMediaIds.push(doc.id);

			// Navigate to media library
			await authenticatedPage.goto('/admin/media');
			await authenticatedPage.waitForLoadState('domcontentloaded');

			// Wait for the grid to load and find the uploaded media item
			const cardContainer = authenticatedPage.locator('.group').filter({
				has: authenticatedPage.getByLabel(`View ${doc.filename}`),
			});
			await expect(cardContainer).toBeVisible({ timeout: 10000 });

			// Hover over the media card to reveal edit button, then click it
			await cardContainer.hover();
			await cardContainer.getByLabel('Edit file details').click();

			// Dialog opens — verify focal point picker is visible for images
			// The picker shows "Focal Point" heading and a "Reset to center" button
			await expect(authenticatedPage.getByText('Focal Point', { exact: true })).toBeVisible({
				timeout: 10000,
			});
			await expect(authenticatedPage.getByText(/Reset to center/)).toBeVisible();
		});
	},
);

// ============================================================
// Part F: Security
// ============================================================

test.describe(
	'Image Processing Security',
	{ tag: ['@media', '@image-processing', '@security'] },
	() => {
		test('should reject unauthenticated image upload', async ({ request }) => {
			const response = await request.post('/api/media', {
				multipart: {
					file: {
						name: 'unauth-img.png',
						mimeType: 'image/png',
						buffer: PROCESSABLE_PNG,
					},
				},
			});
			expect(response.status()).toBe(401);
		});

		test('should not have path traversal in variant URLs', async ({ authenticatedPage }) => {
			const uploadResp = await authenticatedPage.request.post('/api/media', {
				multipart: {
					file: {
						name: 'traversal-check.png',
						mimeType: 'image/png',
						buffer: PROCESSABLE_PNG,
					},
				},
			});
			expect(uploadResp.status()).toBe(201);
			const { doc } = await uploadResp.json();

			// Assert sizes exist — don't silently skip security checks
			expect(doc.sizes).toBeDefined();
			// Check that variant paths don't contain traversal patterns
			for (const [, variant] of Object.entries(doc.sizes)) {
				const v = variant as { path?: string; url?: string };
				if (v.path) {
					expect(v.path).not.toContain('..');
				}
				if (v.url) {
					expect(v.url).not.toContain('..');
				}
			}

			// Cleanup
			await authenticatedPage.request.delete(`/api/media/${doc.id}`);
		});
	},
);
