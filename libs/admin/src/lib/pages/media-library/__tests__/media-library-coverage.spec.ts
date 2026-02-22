/**
 * Additional coverage tests for MediaLibraryPage.
 *
 * Targets remaining uncovered statements/branches not reached by the
 * base, extended, or extended2 spec files. Focuses on:
 * - onFilesSelected: multi-file upload progress, error flows, input reset
 * - deleteMedia / deleteSelected: interleaved confirm + API patterns
 * - editMedia: dialog afterClosed with various result shapes
 * - viewMedia: window.open with undefined defaultView
 * - formatFileSize: boundary values
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { MediaLibraryPage } from '../media-library.page';
import { MOMENTUM_API } from '../../../services/momentum-api.service';
import { UploadService, type UploadProgress } from '../../../services/upload.service';
import { FeedbackService } from '../../../widgets/feedback/feedback.service';
import { ToastService, DialogService } from '@momentumcms/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MediaItem {
	id: string;
	filename: string;
	mimeType: string;
	path: string;
	url?: string;
	filesize?: number;
	alt?: string;
	width?: number;
	height?: number;
}

function validMedia(overrides: Partial<MediaItem> = {}): MediaItem {
	return {
		id: 'media-1',
		filename: 'photo.jpg',
		mimeType: 'image/jpeg',
		path: 'uploads/photo.jpg',
		...overrides,
	};
}

function createFileEvent(files: File[]): Event {
	const indexed: Record<number, File> = {};
	for (let i = 0; i < files.length; i++) {
		indexed[i] = files[i];
	}
	const fileList = {
		...indexed,
		length: files.length,
		item: (i: number): File | null => files[i] ?? null,
		[Symbol.iterator]: function* (): Generator<File> {
			for (const f of files) {
				yield f;
			}
		},
	} as unknown as FileList;

	const input = document.createElement('input');
	input.type = 'file';
	Object.defineProperty(input, 'files', { value: fileList, writable: false });

	const event = new Event('change', { bubbles: true });
	Object.defineProperty(event, 'target', { value: input });
	return event;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockCollection {
	find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 1 });
	delete = vi.fn().mockResolvedValue({ id: '1', deleted: true });
	batchDelete = vi.fn().mockResolvedValue([]);
}

class MockApiService {
	collection = vi.fn();
	global = vi.fn();
	getConfig = vi.fn();
	setContext = vi.fn().mockReturnThis();
	getContext = vi.fn().mockReturnValue({});

	constructor(coll: MockCollection) {
		this.collection.mockReturnValue(coll);
	}
}

class MockUploadService {
	upload = vi.fn();
}

class MockFeedbackService {
	confirmDelete = vi.fn().mockResolvedValue(true);
	confirmBulkDelete = vi.fn().mockResolvedValue(true);
	operationFailed = vi.fn();
}

class MockToastService {
	error = vi.fn();
	success = vi.fn();
}

class MockDialogService {
	open = vi.fn().mockReturnValue({ afterClosed: new Subject() });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MediaLibraryPage - coverage', () => {
	let fixture: ComponentFixture<MediaLibraryPage>;
	let component: MediaLibraryPage;

	let mockCollection: MockCollection;
	let mockApi: MockApiService;
	let mockUpload: MockUploadService;
	let mockFeedback: MockFeedbackService;
	let mockToast: MockToastService;
	let mockDialog: MockDialogService;

	beforeEach(async () => {
		mockCollection = new MockCollection();
		mockApi = new MockApiService(mockCollection);
		mockUpload = new MockUploadService();
		mockFeedback = new MockFeedbackService();
		mockToast = new MockToastService();
		mockDialog = new MockDialogService();

		await TestBed.configureTestingModule({
			imports: [MediaLibraryPage],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'server' },
				{ provide: MOMENTUM_API, useValue: mockApi },
				{ provide: UploadService, useValue: mockUpload },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: ToastService, useValue: mockToast },
				{ provide: DialogService, useValue: mockDialog },
			],
		})
			.overrideComponent(MediaLibraryPage, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(MediaLibraryPage);
		component = fixture.componentInstance;
	});

	// -----------------------------------------------------------------------
	// Upload progress tracking: intermediate "uploading" status updates
	// -----------------------------------------------------------------------
	describe('onFilesSelected - upload progress tracking', () => {
		it('should update progress for multiple files independently', () => {
			const subject1 = new Subject<UploadProgress>();
			const subject2 = new Subject<UploadProgress>();
			mockUpload.upload
				.mockReturnValueOnce(subject1.asObservable())
				.mockReturnValueOnce(subject2.asObservable());

			const file1 = new File(['a'], 'file1.jpg', { type: 'image/jpeg' });
			const file2 = new File(['b'], 'file2.png', { type: 'image/png' });

			component.onFilesSelected(createFileEvent([file1, file2]));

			// Progress update for file1 only
			subject1.next({ status: 'uploading', progress: 30, file: file1 });

			const uploads = component.activeUploads();
			expect(uploads.length).toBe(2);
			expect(uploads[0].progress).toBe(30);
			expect(uploads[0].status).toBe('uploading');
			// file2 still at initial state
			expect(uploads[1].progress).toBe(0);
		});

		it('should handle upload completing while another is still in progress', () => {
			const subject1 = new Subject<UploadProgress>();
			const subject2 = new Subject<UploadProgress>();
			mockUpload.upload
				.mockReturnValueOnce(subject1.asObservable())
				.mockReturnValueOnce(subject2.asObservable());

			const file1 = new File(['a'], 'file1.jpg', { type: 'image/jpeg' });
			const file2 = new File(['b'], 'file2.png', { type: 'image/png' });

			component.onFilesSelected(createFileEvent([file1, file2]));

			// Complete file1
			subject1.next({
				status: 'complete',
				progress: 100,
				file: file1,
				result: {
					id: 'new-1',
					filename: 'file1.jpg',
					mimeType: 'image/jpeg',
					path: 'uploads/file1.jpg',
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-01T00:00:00Z',
				} as never,
			});

			// Only file2 should remain
			expect(component.activeUploads().length).toBe(1);
			expect(component.activeUploads()[0].file.name).toBe('file2.png');

			// Now progress file2
			subject2.next({ status: 'uploading', progress: 75, file: file2 });
			expect(component.activeUploads()[0].progress).toBe(75);
		});

		it('should handle error on one file while another succeeds', () => {
			const subject1 = new Subject<UploadProgress>();
			const subject2 = new Subject<UploadProgress>();
			mockUpload.upload
				.mockReturnValueOnce(subject1.asObservable())
				.mockReturnValueOnce(subject2.asObservable());

			const file1 = new File(['a'], 'file1.jpg', { type: 'image/jpeg' });
			const file2 = new File(['b'], 'file2.png', { type: 'image/png' });

			component.onFilesSelected(createFileEvent([file1, file2]));

			// Error on file1
			subject1.next({
				status: 'error',
				progress: 0,
				file: file1,
				error: 'Too large',
			});
			expect(component.activeUploads().length).toBe(1);
			expect(mockToast.error).toHaveBeenCalledWith(
				'Upload failed',
				expect.stringContaining('Too large'),
			);

			// Complete file2
			subject2.next({
				status: 'complete',
				progress: 100,
				file: file2,
				result: {
					id: 'new-2',
					filename: 'file2.png',
					mimeType: 'image/png',
					path: 'uploads/file2.png',
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-01T00:00:00Z',
				} as never,
			});
			expect(component.activeUploads().length).toBe(0);
		});
	});

	// -----------------------------------------------------------------------
	// viewMedia calls window.open
	// -----------------------------------------------------------------------
	describe('viewMedia - opens in new tab', () => {
		it('should call window.open with media URL', () => {
			const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

			const media = validMedia({
				id: 'v1',
				url: 'https://cdn.example.com/photo.jpg',
			});
			component.viewMedia(media);

			expect(openSpy).toHaveBeenCalledWith('https://cdn.example.com/photo.jpg', '_blank');
			openSpy.mockRestore();
		});

		it('should call window.open with fallback URL when media has no url', () => {
			const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

			const media = validMedia({ id: 'v2', path: 'uploads/fallback.jpg' });
			component.viewMedia(media);

			expect(openSpy).toHaveBeenCalledWith('/api/media/file/uploads/fallback.jpg', '_blank');
			openSpy.mockRestore();
		});
	});

	// -----------------------------------------------------------------------
	// deleteMedia - confirmed with successful API call
	// -----------------------------------------------------------------------
	describe('deleteMedia - confirmed success with reload', () => {
		it('should clear loading state after successful delete and reload', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmDelete.mockResolvedValue(true);
			mockCollection.delete.mockResolvedValue({ id: 'm1', deleted: true });

			const media = validMedia({ id: 'm1', filename: 'test.jpg' });
			await component.deleteMedia(media);

			expect(mockCollection.delete).toHaveBeenCalledWith('m1');
			// loadMedia should have been called (reload)
			await vi.waitFor(() => {
				expect(mockCollection.find.mock.calls.length).toBeGreaterThanOrEqual(2);
			});
		});
	});

	// -----------------------------------------------------------------------
	// deleteSelected - bulk with multiple items confirmed
	// -----------------------------------------------------------------------
	describe('deleteSelected - bulk confirmed with 3 items', () => {
		it('should pass all IDs to batchDelete', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmBulkDelete.mockResolvedValue(true);
			mockCollection.batchDelete.mockResolvedValue([]);

			component.selectedItems.set(new Set(['a', 'b', 'c']));
			await component.deleteSelected();

			expect(mockFeedback.confirmBulkDelete).toHaveBeenCalledWith('Files', 3);
			const ids = mockCollection.batchDelete.mock.calls[0][0] as string[];
			expect(ids.sort()).toEqual(['a', 'b', 'c']);
			expect(component.selectedItems().size).toBe(0);
		});
	});

	// -----------------------------------------------------------------------
	// formatFileSize - exact boundary values
	// -----------------------------------------------------------------------
	describe('formatFileSize - boundary values', () => {
		it('should format exactly 1 KB', () => {
			expect(component.formatFileSize(1024)).toBe('1.0 KB');
		});

		it('should format exactly 1 MB', () => {
			expect(component.formatFileSize(1024 * 1024)).toBe('1.0 MB');
		});

		it('should format exactly 1 GB', () => {
			expect(component.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
		});

		it('should format 1 byte', () => {
			expect(component.formatFileSize(1)).toBe('1 bytes');
		});

		it('should format 1023 bytes (just under 1 KB)', () => {
			expect(component.formatFileSize(1023)).toBe('1023 bytes');
		});
	});

	// -----------------------------------------------------------------------
	// editMedia - various afterClosed result shapes
	// -----------------------------------------------------------------------
	describe('editMedia - afterClosed edge cases', () => {
		it('should not reload when dialog closes with null result', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			const afterClosedSubject = new Subject<null>();
			mockDialog.open.mockReturnValue({ afterClosed: afterClosedSubject.asObservable() });

			const media = validMedia({ id: 'edit-null' });
			component.editMedia(media);

			const findCallsBefore = mockCollection.find.mock.calls.length;

			afterClosedSubject.next(null);
			afterClosedSubject.complete();

			await new Promise((r) => setTimeout(r, 50));
			expect(mockCollection.find.mock.calls.length).toBe(findCallsBefore);
		});
	});

	// -----------------------------------------------------------------------
	// toggleSelection - multiple operations in sequence
	// -----------------------------------------------------------------------
	describe('toggleSelection - complex sequences', () => {
		it('should handle toggling same item multiple times', () => {
			const media = validMedia({ id: 'toggle-1' });

			component.toggleSelection(media);
			expect(component.selectedItems().has('toggle-1')).toBe(true);

			component.toggleSelection(media);
			expect(component.selectedItems().has('toggle-1')).toBe(false);

			component.toggleSelection(media);
			expect(component.selectedItems().has('toggle-1')).toBe(true);
		});

		it('should maintain other selections when toggling one item', () => {
			const m1 = validMedia({ id: 'sel-1' });
			const m2 = validMedia({ id: 'sel-2' });
			const m3 = validMedia({ id: 'sel-3' });

			component.toggleSelection(m1);
			component.toggleSelection(m2);
			component.toggleSelection(m3);
			expect(component.selectedItems().size).toBe(3);

			// Deselect m2
			component.toggleSelection(m2);
			expect(component.selectedItems().size).toBe(2);
			expect(component.selectedItems().has('sel-1')).toBe(true);
			expect(component.selectedItems().has('sel-2')).toBe(false);
			expect(component.selectedItems().has('sel-3')).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// getMediaUrl - edge cases
	// -----------------------------------------------------------------------
	describe('getMediaUrl - edge cases', () => {
		it('should return empty string when url is empty (nullish coalescing does not fallback on empty string)', () => {
			const media = validMedia({ url: '' });
			// ?? only treats null/undefined as nullish, empty string passes through
			expect(component.getMediaUrl(media)).toBe('');
		});

		it('should use fallback when url is undefined', () => {
			const media = validMedia({ url: undefined });
			expect(component.getMediaUrl(media)).toBe('/api/media/file/uploads/photo.jpg');
		});
	});

	// -----------------------------------------------------------------------
	// onSearchChange resets page and triggers loadMedia
	// -----------------------------------------------------------------------
	describe('onSearchChange - integration with loadMedia', () => {
		it('should trigger loadMedia with the new search and page 1', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockCollection.find.mockClear();
			mockCollection.find.mockResolvedValue({
				docs: [validMedia({ id: 'found-1', filename: 'landscape.png' })],
				totalDocs: 1,
				totalPages: 1,
			});

			component.onSearchChange('landscape');

			await vi.waitFor(() => {
				const calls = mockCollection.find.mock.calls;
				const lastCall = calls[calls.length - 1]?.[0];
				expect(lastCall?.where).toEqual({ filename: { contains: 'landscape' } });
				expect(lastCall?.page).toBe(1);
			});
		});
	});
});
