import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpEventType, type HttpProgressEvent } from '@angular/common/http';
import { UploadService, type UploadProgress } from '../upload.service';
import type { MediaDocument } from '@momentumcms/core';

describe('UploadService', () => {
	let service: UploadService;
	let httpMock: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(UploadService);
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	// ============================================
	// Fixtures
	// ============================================

	function createMockFile(name = 'test.png', type = 'image/png', size = 1024): File {
		const content = new Uint8Array(size);
		return new File([content], name, { type });
	}

	const mockMediaDocument: MediaDocument = {
		id: 'media-1',
		filename: 'test.png',
		mimeType: 'image/png',
		filesize: 1024,
		path: 'uploads/test.png',
		url: '/api/media/file/uploads/test.png',
		alt: 'Test image',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	const mockSuccessBody = {
		doc: mockMediaDocument,
		status: 200,
	};

	const mockErrorBody = {
		error: 'File too large',
		status: 400,
	};

	// ============================================
	// Signal Defaults
	// ============================================

	describe('signal defaults', () => {
		it('activeUploadCount should start at 0', () => {
			expect(service.activeUploadCount()).toBe(0);
		});

		it('isUploading should start as false', () => {
			expect(service.isUploading()).toBe(false);
		});
	});

	// ============================================
	// upload()
	// ============================================

	describe('upload', () => {
		it('should POST to /api/media/upload with FormData', () => {
			const file = createMockFile();

			service.upload(file).subscribe();

			const req = httpMock.expectOne('/api/media/upload');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toBeInstanceOf(FormData);
			req.flush(mockSuccessBody);
		});

		it('should include file in FormData', () => {
			const file = createMockFile('photo.jpg', 'image/jpeg');

			service.upload(file).subscribe();

			const req = httpMock.expectOne('/api/media/upload');
			const formData = req.request.body as FormData;
			expect(formData.get('file')).toBeInstanceOf(File);
			expect((formData.get('file') as File).name).toBe('photo.jpg');
			req.flush(mockSuccessBody);
		});

		it('should include alt text when provided', () => {
			const file = createMockFile();

			service.upload(file, 'A test image').subscribe();

			const req = httpMock.expectOne('/api/media/upload');
			const formData = req.request.body as FormData;
			expect(formData.get('alt')).toBe('A test image');
			req.flush(mockSuccessBody);
		});

		it('should not include alt when not provided', () => {
			const file = createMockFile();

			service.upload(file).subscribe();

			const req = httpMock.expectOne('/api/media/upload');
			const formData = req.request.body as FormData;
			expect(formData.get('alt')).toBeNull();
			req.flush(mockSuccessBody);
		});

		it('should emit upload progress events', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.upload(file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media/upload');

			// Simulate upload progress event
			req.event({
				type: HttpEventType.UploadProgress,
				loaded: 512,
				total: 1024,
			} as HttpProgressEvent);

			const progressEvent = emitted.find((e) => e.status === 'uploading');
			expect(progressEvent).toBeDefined();
			expect(progressEvent?.progress).toBe(50);
			expect(progressEvent?.file).toBe(file);

			// Complete the request
			req.flush(mockSuccessBody);
		});

		it('should calculate progress as 0 when total is missing', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.upload(file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media/upload');

			// Progress event without total
			req.event({
				type: HttpEventType.UploadProgress,
				loaded: 512,
			} as HttpProgressEvent);

			const progressEvent = emitted.find((e) => e.status === 'uploading');
			expect(progressEvent).toBeDefined();
			expect(progressEvent?.progress).toBe(0);

			req.flush(mockSuccessBody);
		});

		it('should emit complete on successful response with doc', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.upload(file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media/upload');
			req.flush(mockSuccessBody);

			const completeEvent = emitted.find((e) => e.status === 'complete');
			expect(completeEvent).toBeDefined();
			expect(completeEvent?.progress).toBe(100);
			expect(completeEvent?.result).toEqual(mockMediaDocument);
			expect(completeEvent?.file).toBe(file);
		});

		it('should emit error when response body has no doc', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.upload(file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media/upload');
			req.flush(mockErrorBody);

			const errorEvent = emitted.find((e) => e.status === 'error');
			expect(errorEvent).toBeDefined();
			expect(errorEvent?.error).toBe('File too large');
			expect(errorEvent?.progress).toBe(0);
		});

		it('should emit error with default message when body has no error string', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.upload(file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media/upload');
			req.flush({ status: 500 });

			const errorEvent = emitted.find((e) => e.status === 'error');
			expect(errorEvent).toBeDefined();
			expect(errorEvent?.error).toBe('Upload failed');
		});

		it('should emit error on HTTP failure', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];
			let errorCaught: Error | undefined;

			service.upload(file).subscribe({
				next: (p) => emitted.push(p),
				error: (err: Error) => {
					errorCaught = err;
				},
			});

			const req = httpMock.expectOne('/api/media/upload');
			req.error(new ProgressEvent('error'), {
				status: 500,
				statusText: 'Server Error',
			});

			const errorEvent = emitted.find((e) => e.status === 'error');
			expect(errorEvent).toBeDefined();
			expect(errorEvent?.progress).toBe(0);
			expect(errorEvent?.file).toBe(file);
			expect(errorCaught).toBeDefined();
		});

		it('should set pending state in active uploads before HTTP response', () => {
			const file = createMockFile();

			// Subscribing triggers the upload, which sets pending in activeUploadsSignal
			service.upload(file).subscribe();

			// The active uploads signal should reflect the pending state
			expect(service.activeUploadCount()).toBe(1);
			expect(service.isUploading()).toBe(true);

			const req = httpMock.expectOne('/api/media/upload');
			req.flush(mockSuccessBody);
		});
	});

	// ============================================
	// uploadToCollection()
	// ============================================

	describe('uploadToCollection', () => {
		it('should POST to /api/{collectionSlug} with FormData', () => {
			const file = createMockFile();

			service.uploadToCollection('documents', file).subscribe();

			const req = httpMock.expectOne('/api/documents');
			expect(req.request.method).toBe('POST');
			expect(req.request.body).toBeInstanceOf(FormData);
			req.flush(mockSuccessBody);
		});

		it('should include file in FormData', () => {
			const file = createMockFile('report.pdf', 'application/pdf');

			service.uploadToCollection('documents', file).subscribe();

			const req = httpMock.expectOne('/api/documents');
			const formData = req.request.body as FormData;
			expect(formData.get('file')).toBeInstanceOf(File);
			expect((formData.get('file') as File).name).toBe('report.pdf');
			req.flush(mockSuccessBody);
		});

		it('should include additional fields in FormData', () => {
			const file = createMockFile();
			const fields = { alt: 'Banner image', title: 'Hero' };

			service.uploadToCollection('media', file, fields).subscribe();

			const req = httpMock.expectOne('/api/media');
			const formData = req.request.body as FormData;
			expect(formData.get('alt')).toBe('Banner image');
			expect(formData.get('title')).toBe('Hero');
			req.flush(mockSuccessBody);
		});

		it('should not add fields when not provided', () => {
			const file = createMockFile();

			service.uploadToCollection('media', file).subscribe();

			const req = httpMock.expectOne('/api/media');
			const formData = req.request.body as FormData;
			expect(formData.get('file')).toBeInstanceOf(File);
			expect(formData.get('alt')).toBeNull();
			req.flush(mockSuccessBody);
		});

		it('should track upload progress', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.uploadToCollection('media', file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media');

			req.event({
				type: HttpEventType.UploadProgress,
				loaded: 768,
				total: 1024,
			} as HttpProgressEvent);

			const progressEvent = emitted.find((e) => e.status === 'uploading');
			expect(progressEvent).toBeDefined();
			expect(progressEvent?.progress).toBe(75);

			req.flush(mockSuccessBody);
		});

		it('should emit complete on successful response', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.uploadToCollection('media', file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media');
			req.flush(mockSuccessBody);

			const completeEvent = emitted.find((e) => e.status === 'complete');
			expect(completeEvent).toBeDefined();
			expect(completeEvent?.progress).toBe(100);
			expect(completeEvent?.result).toEqual(mockMediaDocument);
		});

		it('should emit error when response has no doc', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];

			service.uploadToCollection('media', file).subscribe((p) => emitted.push(p));

			const req = httpMock.expectOne('/api/media');
			req.flush(mockErrorBody);

			const errorEvent = emitted.find((e) => e.status === 'error');
			expect(errorEvent).toBeDefined();
			expect(errorEvent?.error).toBe('File too large');
		});

		it('should emit error on HTTP failure', () => {
			const file = createMockFile();
			const emitted: UploadProgress[] = [];
			let errorCaught: Error | undefined;

			service.uploadToCollection('media', file).subscribe({
				next: (p) => emitted.push(p),
				error: (err: Error) => {
					errorCaught = err;
				},
			});

			const req = httpMock.expectOne('/api/media');
			req.error(new ProgressEvent('error'), {
				status: 413,
				statusText: 'Payload Too Large',
			});

			const errorEvent = emitted.find((e) => e.status === 'error');
			expect(errorEvent).toBeDefined();
			expect(errorEvent?.progress).toBe(0);
			expect(errorCaught).toBeDefined();
		});

		it('should use correct URL for different collection slugs', () => {
			const file = createMockFile();

			service.uploadToCollection('avatars', file).subscribe();

			const req = httpMock.expectOne('/api/avatars');
			expect(req.request.method).toBe('POST');
			req.flush(mockSuccessBody);
		});
	});

	// ============================================
	// uploadMultiple()
	// ============================================

	describe('uploadMultiple', () => {
		it('should return array of observables for each file', () => {
			const files = [createMockFile('a.png'), createMockFile('b.png'), createMockFile('c.png')];

			const observables = service.uploadMultiple(files);
			expect(observables).toHaveLength(3);

			// Subscribe and flush to avoid open requests in verify
			observables.forEach((obs) => obs.subscribe());
			const requests = httpMock.match('/api/media/upload');
			for (const req of requests) {
				req.flush(mockSuccessBody);
			}
		});

		it('should create separate upload requests for each file', () => {
			const files = [createMockFile('a.png'), createMockFile('b.png')];

			const observables = service.uploadMultiple(files);
			observables.forEach((obs) => obs.subscribe());

			const requests = httpMock.match('/api/media/upload');
			expect(requests).toHaveLength(2);

			for (const req of requests) {
				req.flush(mockSuccessBody);
			}
		});

		it('should return empty array for empty files', () => {
			const observables = service.uploadMultiple([]);

			expect(observables).toHaveLength(0);
		});

		it('each observable should emit progress independently', () => {
			const files = [createMockFile('a.png'), createMockFile('b.png')];
			const emittedA: UploadProgress[] = [];
			const emittedB: UploadProgress[] = [];

			const observables = service.uploadMultiple(files);
			observables[0].subscribe((p) => emittedA.push(p));
			observables[1].subscribe((p) => emittedB.push(p));

			const requests = httpMock.match('/api/media/upload');

			// Complete first file only
			requests[0].flush(mockSuccessBody);

			expect(emittedA.some((e) => e.status === 'complete')).toBe(true);
			expect(emittedB.some((e) => e.status === 'complete')).toBe(false);

			// Complete second file
			requests[1].flush(mockSuccessBody);
			expect(emittedB.some((e) => e.status === 'complete')).toBe(true);
		});
	});

	// ============================================
	// getMediaUrl()
	// ============================================

	describe('getMediaUrl', () => {
		it('should return URL for string ID', () => {
			const url = service.getMediaUrl('abc123');

			expect(url).toBe('/api/media/file/abc123');
		});

		it('should return url property from MediaDocument when present', () => {
			const media: MediaDocument = {
				...mockMediaDocument,
				url: '/api/media/file/uploads/test.png',
			};

			const url = service.getMediaUrl(media);

			expect(url).toBe('/api/media/file/uploads/test.png');
		});

		it('should return path-based URL when MediaDocument has no url property', () => {
			const media: MediaDocument = {
				id: 'media-2',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: 'images/photo.jpg',
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
			};

			const url = service.getMediaUrl(media);

			expect(url).toBe('/api/media/file/images/photo.jpg');
		});
	});

	// ============================================
	// Active Upload Tracking (Signals)
	// ============================================

	describe('active upload tracking', () => {
		it('should track active upload count during upload', () => {
			const file = createMockFile();

			expect(service.activeUploadCount()).toBe(0);
			expect(service.isUploading()).toBe(false);

			service.upload(file).subscribe();

			// After starting upload, count should increase
			expect(service.activeUploadCount()).toBe(1);
			expect(service.isUploading()).toBe(true);

			const req = httpMock.expectOne('/api/media/upload');
			req.flush(mockSuccessBody);

			// After finalize runs, the file is removed from active uploads
			expect(service.activeUploadCount()).toBe(0);
			expect(service.isUploading()).toBe(false);
		});

		it('should track multiple concurrent uploads', () => {
			const fileA = createMockFile('a.png');
			const fileB = createMockFile('b.png');

			service.upload(fileA).subscribe();
			service.upload(fileB).subscribe();

			expect(service.activeUploadCount()).toBe(2);
			expect(service.isUploading()).toBe(true);

			const requests = httpMock.match('/api/media/upload');
			expect(requests).toHaveLength(2);

			// Complete first upload
			requests[0].flush(mockSuccessBody);

			expect(service.activeUploadCount()).toBe(1);
			expect(service.isUploading()).toBe(true);

			// Complete second upload
			requests[1].flush(mockSuccessBody);

			expect(service.activeUploadCount()).toBe(0);
			expect(service.isUploading()).toBe(false);
		});

		it('should not count completed uploads as active', () => {
			const file = createMockFile();

			service.upload(file).subscribe();

			const req = httpMock.expectOne('/api/media/upload');
			req.flush(mockSuccessBody);

			expect(service.activeUploadCount()).toBe(0);
		});

		it('should not count errored uploads as active', () => {
			const file = createMockFile();

			service.upload(file).subscribe({
				error: () => {
					// expected
				},
			});

			const req = httpMock.expectOne('/api/media/upload');
			req.error(new ProgressEvent('error'), {
				status: 500,
				statusText: 'Internal Server Error',
			});

			expect(service.activeUploadCount()).toBe(0);
		});

		it('should track uploadToCollection in active uploads', () => {
			const file = createMockFile();

			expect(service.activeUploadCount()).toBe(0);

			service.uploadToCollection('media', file).subscribe();

			expect(service.activeUploadCount()).toBe(1);
			expect(service.isUploading()).toBe(true);

			const req = httpMock.expectOne('/api/media');
			req.flush(mockSuccessBody);

			expect(service.activeUploadCount()).toBe(0);
			expect(service.isUploading()).toBe(false);
		});
	});
});
