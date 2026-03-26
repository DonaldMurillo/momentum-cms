/**
 * Extended coverage tests for MediaPickerDialog.
 *
 * The base spec (media-picker-dialog.spec.ts) covers initial state, collectionSlug,
 * onSearchChange, onPageChange, selectMedia, confirmSelection, and confirm.
 *
 * This file targets the uncovered loadMedia() branches:
 * - API call via injectMomentumAPI (intercepted at HTTP level)
 * - Server-side search filtering (filename contains via where clause)
 * - Server-side MIME type filtering (exact match and wildcard via where clause)
 * - Pagination totals always from server response
 * - Error handling in loadMedia
 * - toMediaItems / isMediaItem type guard branches
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@momentumcms/ui';
import {
	MediaPickerDialog,
	type MediaItem,
	type MediaPickerDialogData,
} from '../media-picker-dialog.component';

// Stub child components to avoid template compilation issues
@Component({ selector: 'mcms-dialog', template: '<ng-content />' })
class MockDialog {}

@Component({ selector: 'mcms-dialog-header', template: '<ng-content />' })
class MockDialogHeader {}

@Component({ selector: 'mcms-dialog-title', template: '<ng-content />' })
class MockDialogTitle {}

@Component({ selector: 'mcms-dialog-content', template: '<ng-content />' })
class MockDialogContent {}

@Component({ selector: 'mcms-dialog-footer', template: '<ng-content />' })
class MockDialogFooter {}

class MockDialogRef {
	close = vi.fn();
}

/** Helper to flush microtasks */
async function flushPromises(): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, 0);
	});
}

describe('MediaPickerDialog (coverage - loadMedia branches)', () => {
	let fixture: ComponentFixture<MediaPickerDialog>;
	let component: MediaPickerDialog;
	let mockDialogRef: MockDialogRef;
	let httpMock: HttpTestingController;

	function setup(data: MediaPickerDialogData = {}): void {
		mockDialogRef = new MockDialogRef();

		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [MediaPickerDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: DialogRef, useValue: mockDialogRef },
				{ provide: DIALOG_DATA, useValue: data },
			],
		}).overrideComponent(MediaPickerDialog, {
			set: {
				imports: [
					MockDialog,
					MockDialogHeader,
					MockDialogTitle,
					MockDialogContent,
					MockDialogFooter,
				],
				template: '<div></div>',
			},
		});

		fixture = TestBed.createComponent(MediaPickerDialog);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);
		fixture.detectChanges();
	}

	/** Flush the initial auto-fetch request from the effect with given response */
	function flushApiRequest(response: {
		docs: unknown[];
		totalDocs?: number;
		totalPages?: number;
	}): void {
		const reqs = httpMock.match((r) => r.url.startsWith('/api/'));
		for (const req of reqs) {
			if (!req.cancelled) {
				req.flush(response);
			}
		}
	}

	afterEach(() => {
		// Flush any remaining requests
		const pending = httpMock.match(() => true);
		for (const req of pending) {
			if (!req.cancelled) {
				req.flush({ docs: [] });
			}
		}
	});

	// ------------------------------------------------------------------
	// loadMedia: successful API call returning valid media items
	// ------------------------------------------------------------------
	describe('loadMedia with valid media items', () => {
		it('should populate mediaItems from API docs', async () => {
			setup({});
			await flushPromises();

			const docs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/uploads/photo.jpg' },
				{ id: '2', filename: 'doc.pdf', mimeType: 'application/pdf', path: '/uploads/doc.pdf' },
			];
			flushApiRequest({ docs, totalDocs: 2, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(2);
			expect(component.mediaItems()[0].filename).toBe('photo.jpg');
			expect(component.isLoading()).toBe(false);
		});

		it('should set totalDocs and totalPages from API when no client filter', async () => {
			setup({});
			await flushPromises();

			const docs: MediaItem[] = [
				{ id: '1', filename: 'a.jpg', mimeType: 'image/jpeg', path: '/a.jpg' },
			];
			flushApiRequest({ docs, totalDocs: 50, totalPages: 3 });
			await flushPromises();

			expect(component.totalDocs()).toBe(50);
			expect(component.totalPages()).toBe(3);
		});

		it('should pass page and limit to API find call', async () => {
			setup({});
			await flushPromises();

			const reqs = httpMock.match((r) => r.url.startsWith('/api/media'));
			expect(reqs.length).toBeGreaterThan(0);

			const req = reqs[reqs.length - 1];
			expect(req.request.params.get('page')).toBe('1');
			expect(req.request.params.get('limit')).toBeTruthy();

			for (const r of reqs) {
				r.flush({ docs: [], totalDocs: 0, totalPages: 1 });
			}
		});
	});

	// ------------------------------------------------------------------
	// loadMedia: server-side search filtering (via where clause)
	// ------------------------------------------------------------------
	describe('loadMedia with search filtering', () => {
		it('should send search to server and display returned results', async () => {
			setup({});
			await flushPromises();

			const initialDocs: MediaItem[] = [
				{ id: '1', filename: 'Photo_One.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
				{ id: '2', filename: 'document.pdf', mimeType: 'application/pdf', path: '/2.pdf' },
				{ id: '3', filename: 'PHOTO_TWO.png', mimeType: 'image/png', path: '/3.png' },
			];
			flushApiRequest({ docs: initialDocs, totalDocs: 3, totalPages: 1 });
			await flushPromises();

			// Trigger search — server returns filtered results
			component.onSearchChange('photo');
			await flushPromises();

			// Verify the search term is sent in the where clause
			const reqs = httpMock.match((r) => r.url.startsWith('/api/'));
			expect(reqs.length).toBeGreaterThan(0);
			const searchReq = reqs[reqs.length - 1];
			const whereParam = searchReq.request.params.get('where');
			expect(whereParam).toBeTruthy();
			const where = JSON.parse(whereParam as string);
			// Media picker uses direct filename filter (not OR with alt like the library page)
			expect(where).toHaveProperty('filename');
			expect((where['filename'] as Record<string, unknown>)['contains']).toBe('photo');

			const filteredDocs: MediaItem[] = [
				{ id: '1', filename: 'Photo_One.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
				{ id: '3', filename: 'PHOTO_TWO.png', mimeType: 'image/png', path: '/3.png' },
			];
			for (const r of reqs) {
				if (!r.cancelled) r.flush({ docs: filteredDocs, totalDocs: 2, totalPages: 1 });
			}
			await flushPromises();

			expect(component.mediaItems().length).toBe(2);
			expect(component.mediaItems().map((m) => m.id)).toEqual(['1', '3']);
		});

		it('should preserve server totalPages when search is active', async () => {
			setup({});
			await flushPromises();

			const docs: MediaItem[] = [
				{ id: '1', filename: 'alpha.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
			];
			flushApiRequest({ docs, totalDocs: 50, totalPages: 3 });
			await flushPromises();

			component.onSearchChange('alpha');
			await flushPromises();

			// Server filters and returns paginated results
			flushApiRequest({ docs, totalDocs: 25, totalPages: 2 });
			await flushPromises();

			expect(component.totalDocs()).toBe(25);
			expect(component.totalPages()).toBe(2);
		});

		it('should display empty array when server returns no matches', async () => {
			setup({});
			await flushPromises();

			const docs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
			];
			flushApiRequest({ docs, totalDocs: 1, totalPages: 1 });
			await flushPromises();

			component.onSearchChange('nonexistent');
			await flushPromises();

			// Server returns empty filtered results
			flushApiRequest({ docs: [], totalDocs: 0, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(0);
			expect(component.totalDocs()).toBe(0);
		});
	});

	// ------------------------------------------------------------------
	// loadMedia: server-side MIME type filtering (via where clause)
	// ------------------------------------------------------------------
	describe('loadMedia with MIME type filtering', () => {
		it('should display server-filtered results for exact MIME type', async () => {
			setup({ mimeTypes: ['image/jpeg'] });
			await flushPromises();

			// Server returns only matching MIME types
			const docs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
			];
			flushApiRequest({ docs, totalDocs: 1, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(1);
			expect(component.mediaItems()[0].id).toBe('1');
		});

		it('should display server-filtered results for wildcard MIME type (image/*)', async () => {
			setup({ mimeTypes: ['image/*'] });
			await flushPromises();

			// Server returns images only
			const docs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
				{ id: '3', filename: 'img.png', mimeType: 'image/png', path: '/3.png' },
			];
			flushApiRequest({ docs, totalDocs: 2, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(2);
			expect(component.mediaItems().map((m) => m.id)).toEqual(['1', '3']);
		});

		it('should use unprefixed "or" key (not "$or") in the where clause for MIME conditions', async () => {
			setup({ mimeTypes: ['image/*', 'video/mp4'] });
			await flushPromises();

			const reqs = httpMock.match((r) => r.url.startsWith('/api/'));
			expect(reqs.length).toBeGreaterThan(0);

			const req = reqs[reqs.length - 1];
			const whereParam = req.request.params.get('where');
			expect(whereParam).toBeTruthy();

			const where = JSON.parse(whereParam as string);
			// The server-side where processor only recognizes unprefixed "or" as logical OR.
			// Using "$or" causes a ValidationError ("Unknown field: $or").
			expect(where).toHaveProperty('or');
			expect(where).not.toHaveProperty('$or');

			req.flush({ docs: [], totalDocs: 0, totalPages: 1 });
		});

		it('should display server-filtered results for multiple MIME patterns', async () => {
			setup({ mimeTypes: ['image/*', 'video/mp4'] });
			await flushPromises();

			// Server returns images + video/mp4
			const docs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
				{ id: '3', filename: 'video.mp4', mimeType: 'video/mp4', path: '/3.mp4' },
			];
			flushApiRequest({ docs, totalDocs: 2, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(2);
			expect(component.mediaItems().map((m) => m.id)).toEqual(['1', '3']);
		});

		it('should preserve server totalPages when MIME filter is active', async () => {
			setup({ mimeTypes: ['image/jpeg'] });
			await flushPromises();

			const docs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
			];
			flushApiRequest({ docs, totalDocs: 50, totalPages: 3 });
			await flushPromises();

			// Server paginates filtered results — totalPages comes from server
			expect(component.totalDocs()).toBe(50);
			expect(component.totalPages()).toBe(3);
		});

		it('should not filter when mimeTypes array is empty', async () => {
			setup({ mimeTypes: [] });
			await flushPromises();

			const docs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
				{ id: '2', filename: 'doc.pdf', mimeType: 'application/pdf', path: '/2.pdf' },
			];
			flushApiRequest({ docs, totalDocs: 2, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(2);
			expect(component.totalDocs()).toBe(2);
			expect(component.totalPages()).toBe(1);
		});
	});

	// ------------------------------------------------------------------
	// loadMedia: combined search + MIME filter (both server-side)
	// ------------------------------------------------------------------
	describe('loadMedia with combined search and MIME filter', () => {
		it('should display server-filtered results for combined search + MIME', async () => {
			setup({ mimeTypes: ['image/*'] });
			await flushPromises();

			const initialDocs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
				{ id: '3', filename: 'banner.png', mimeType: 'image/png', path: '/3.png' },
			];
			flushApiRequest({ docs: initialDocs, totalDocs: 2, totalPages: 1 });
			await flushPromises();

			component.onSearchChange('photo');
			await flushPromises();

			// Server applies both filename contains + MIME type filter
			const filteredDocs: MediaItem[] = [
				{ id: '1', filename: 'photo.jpg', mimeType: 'image/jpeg', path: '/1.jpg' },
			];
			flushApiRequest({ docs: filteredDocs, totalDocs: 1, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(1);
			expect(component.mediaItems()[0].id).toBe('1');
		});
	});

	// ------------------------------------------------------------------
	// loadMedia: error handling
	// ------------------------------------------------------------------
	describe('loadMedia error handling', () => {
		it('should set empty media items on API error', async () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
				/* noop */
			});

			setup({});
			await flushPromises();

			const reqs = httpMock.match((r) => r.url.startsWith('/api/'));
			for (const req of reqs) {
				req.error(new ProgressEvent('error'));
			}
			await flushPromises();

			expect(component.mediaItems()).toEqual([]);
			expect(component.isLoading()).toBe(false);
			consoleSpy.mockRestore();
		});
	});

	// ------------------------------------------------------------------
	// toMediaItems: filtering invalid items from docs array
	// ------------------------------------------------------------------
	describe('toMediaItems type guard filtering', () => {
		it('should filter out non-object docs', async () => {
			setup({});
			await flushPromises();

			const docs = [
				{ id: '1', filename: 'a.jpg', mimeType: 'image/jpeg', path: '/a.jpg' },
				'invalid-string',
				null,
				42,
			];
			flushApiRequest({ docs, totalDocs: 4, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(1);
			expect(component.mediaItems()[0].id).toBe('1');
		});

		it('should filter out objects missing required fields', async () => {
			setup({});
			await flushPromises();

			const docs = [
				{ id: '1', filename: 'a.jpg', mimeType: 'image/jpeg', path: '/a.jpg' },
				{ id: '2', filename: 'b.jpg' }, // missing mimeType and path
				{ id: '3', mimeType: 'image/png', path: '/c.png' }, // missing filename
				{ filename: 'd.jpg', mimeType: 'image/png', path: '/d.png' }, // missing id
			];
			flushApiRequest({ docs, totalDocs: 4, totalPages: 1 });
			await flushPromises();

			expect(component.mediaItems().length).toBe(1);
			expect(component.mediaItems()[0].id).toBe('1');
		});
	});

	// ------------------------------------------------------------------
	// collectionSlug: custom relationTo
	// ------------------------------------------------------------------
	describe('collectionSlug with custom relationTo', () => {
		it('should query the custom collection slug', () => {
			setup({ relationTo: 'assets' });
			expect(component.collectionSlug()).toBe('assets');
		});
	});

	// ------------------------------------------------------------------
	// Page changes trigger loadMedia
	// ------------------------------------------------------------------
	describe('page change triggers loadMedia', () => {
		it('should re-call API with new page number', async () => {
			setup({});
			await flushPromises();
			flushApiRequest({ docs: [], totalDocs: 0, totalPages: 3 });
			await flushPromises();

			component.onPageChange(2);
			await flushPromises();

			// Verify the page parameter is sent in the request
			const reqs = httpMock.match((r) => r.url.startsWith('/api/'));
			expect(reqs.length).toBeGreaterThan(0);
			const pageReq = reqs[reqs.length - 1];
			expect(pageReq.request.params.get('page')).toBe('2');

			for (const r of reqs) {
				r.flush({ docs: [], totalDocs: 0, totalPages: 3 });
			}
		});
	});

	// ------------------------------------------------------------------
	// Confirm and double-click selection
	// ------------------------------------------------------------------
	describe('selection and confirmation', () => {
		it('should not close dialog when calling confirm with no selection', () => {
			setup({});
			component.confirm();
			expect(mockDialogRef.close).not.toHaveBeenCalled();
		});

		it('should close dialog with media on confirmSelection (double-click)', () => {
			setup({});
			const media: MediaItem = {
				id: 'm1',
				filename: 'pic.jpg',
				mimeType: 'image/jpeg',
				path: '/uploads/pic.jpg',
			};
			component.confirmSelection(media);
			expect(component.selectedMedia()).toBe(media);
			expect(mockDialogRef.close).toHaveBeenCalledWith({ media });
		});

		it('should allow changing selection', () => {
			setup({});
			const media1: MediaItem = {
				id: 'm1',
				filename: 'a.jpg',
				mimeType: 'image/jpeg',
				path: '/a.jpg',
			};
			const media2: MediaItem = {
				id: 'm2',
				filename: 'b.jpg',
				mimeType: 'image/jpeg',
				path: '/b.jpg',
			};

			component.selectMedia(media1);
			expect(component.selectedMedia()).toBe(media1);

			component.selectMedia(media2);
			expect(component.selectedMedia()).toBe(media2);

			component.confirm();
			expect(mockDialogRef.close).toHaveBeenCalledWith({ media: media2 });
		});
	});
});
