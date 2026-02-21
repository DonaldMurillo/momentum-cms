/**
 * Extended tests (part 2) for MediaLibraryPage.
 *
 * Focuses on increasing statement coverage for media-library.page.ts by
 * testing code paths not reached in the base and extended-1 specs:
 *
 * - Helper functions: isMediaItem, toMediaItems, getInputElement
 * - loadMedia: effect-driven call, search where-clause, error path
 * - deleteMedia: confirmed path (success + error)
 * - deleteSelected: confirmed path (success + error)
 * - editMedia: afterClosed with result.updated = true triggers reload
 * - onFilesSelected: multi-file upload, input reset
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
// Typed mock classes (avoids TS4111 index-signature errors)
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
// Test suite
// ---------------------------------------------------------------------------

describe('MediaLibraryPage - extended2 (coverage)', () => {
	let fixture: ComponentFixture<MediaLibraryPage>;
	let component: MediaLibraryPage;

	let mockCollection: MockCollection;
	let mockApi: MockApiService;
	let mockUpload: MockUploadService;
	let mockFeedback: MockFeedbackService;
	let mockToast: MockToastService;
	let mockDialog: MockDialogService;
	let windowOpenSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		mockCollection = new MockCollection();
		mockApi = new MockApiService(mockCollection);
		mockUpload = new MockUploadService();
		mockFeedback = new MockFeedbackService();
		mockToast = new MockToastService();
		mockDialog = new MockDialogService();
		windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

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

	afterEach(() => {
		windowOpenSpy.mockRestore();
	});

	// -----------------------------------------------------------------------
	// Construction / effect-driven loadMedia
	// -----------------------------------------------------------------------

	describe('loadMedia via effect on construction', () => {
		it('should call api.collection("media").find on creation', async () => {
			await vi.waitFor(() => {
				expect(mockApi.collection).toHaveBeenCalledWith('media');
			});

			await vi.waitFor(() => {
				expect(mockCollection.find).toHaveBeenCalledWith(
					expect.objectContaining({
						where: undefined,
						page: 1,
						limit: 24,
						sort: '-createdAt',
					}),
				);
			});
		});

		it('should set isLoading to false after loadMedia completes', async () => {
			await vi.waitFor(() => {
				expect(component.isLoading()).toBe(false);
			});
		});

		it('should populate mediaItems with valid media from API docs', async () => {
			const docs = [
				validMedia({ id: 'a1', filename: 'one.png' }),
				validMedia({ id: 'a2', filename: 'two.jpg' }),
			];
			mockCollection.find.mockResolvedValue({
				docs,
				totalDocs: 2,
				totalPages: 1,
			});

			component.onSearchChange('trigger');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(2);
			});
			expect(component.totalDocs()).toBe(2);
		});

		it('should filter out non-MediaItem docs via toMediaItems', async () => {
			const docs = [
				validMedia({ id: 'm1' }),
				{ id: 'bad' },
				null,
				42,
				'string',
				{ id: 'm2', filename: 'ok.png', mimeType: 'image/png', path: 'uploads/ok.png' },
			];
			mockCollection.find.mockResolvedValue({
				docs,
				totalDocs: 6,
				totalPages: 1,
			});

			component.onSearchChange('filter-test');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(2);
			});
			expect(component.mediaItems()[0].id).toBe('m1');
			expect(component.mediaItems()[1].id).toBe('m2');
		});

		it('should build where clause with filename contains when search is not empty', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
			});

			component.onSearchChange('landscape');

			await vi.waitFor(() => {
				const calls = mockCollection.find.mock.calls;
				const lastCall = calls[calls.length - 1]?.[0];
				expect(lastCall).toBeDefined();
				expect(lastCall.where).toEqual({ filename: { contains: 'landscape' } });
			});
		});

		it('should pass undefined where when search is empty', async () => {
			await vi.waitFor(() => {
				const firstCall = mockCollection.find.mock.calls[0]?.[0];
				expect(firstCall).toBeDefined();
				expect(firstCall.where).toBeUndefined();
			});
		});
	});

	describe('loadMedia error path', () => {
		it('should call feedback.operationFailed and set mediaItems to empty on error', async () => {
			mockCollection.find.mockRejectedValue(new Error('Network error'));

			component.onSearchChange('fail');

			await vi.waitFor(() => {
				expect(mockFeedback.operationFailed).toHaveBeenCalledWith('Failed to load media');
			});
			expect(component.mediaItems()).toEqual([]);
			expect(component.isLoading()).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// deleteMedia - confirmed path
	// -----------------------------------------------------------------------

	describe('deleteMedia - confirmed', () => {
		it('should call collection.delete and reload media on success', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmDelete.mockResolvedValue(true);
			mockCollection.delete.mockResolvedValue({ id: 'm1', deleted: true });

			const media = validMedia({ id: 'm1', filename: 'photo.jpg' });
			await component.deleteMedia(media);

			expect(mockFeedback.confirmDelete).toHaveBeenCalledWith('Media', 'photo.jpg');
			expect(mockCollection.delete).toHaveBeenCalledWith('m1');

			await vi.waitFor(() => {
				expect(mockCollection.find.mock.calls.length).toBeGreaterThanOrEqual(2);
			});
		});

		it('should catch errors from collection.delete without throwing', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmDelete.mockResolvedValue(true);
			mockCollection.delete.mockRejectedValue(new Error('Delete failed'));

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
				/* noop */
			});

			const media = validMedia({ id: 'm2' });
			await expect(component.deleteMedia(media)).resolves.toBeUndefined();

			expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete media:', expect.any(Error));

			consoleErrorSpy.mockRestore();
		});

		it('should not call delete when confirmation is rejected', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmDelete.mockResolvedValue(false);

			const media = validMedia({ id: 'm3' });
			await component.deleteMedia(media);

			expect(mockCollection.delete).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// deleteSelected - confirmed path
	// -----------------------------------------------------------------------

	describe('deleteSelected - confirmed', () => {
		it('should call batchDelete, clear selectedItems, and reload on success', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmBulkDelete.mockResolvedValue(true);
			mockCollection.batchDelete.mockResolvedValue([
				{ id: 's1', deleted: true },
				{ id: 's2', deleted: true },
			]);

			component.selectedItems.set(new Set(['s1', 's2']));

			await component.deleteSelected();

			expect(mockFeedback.confirmBulkDelete).toHaveBeenCalledWith('Files', 2);
			expect(mockCollection.batchDelete).toHaveBeenCalledWith(expect.arrayContaining(['s1', 's2']));
			expect(component.selectedItems().size).toBe(0);

			await vi.waitFor(() => {
				expect(mockCollection.find.mock.calls.length).toBeGreaterThanOrEqual(2);
			});
		});

		it('should catch errors from batchDelete without throwing', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmBulkDelete.mockResolvedValue(true);
			mockCollection.batchDelete.mockRejectedValue(new Error('Batch delete failed'));

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
				/* noop */
			});

			component.selectedItems.set(new Set(['s1']));
			await expect(component.deleteSelected()).resolves.toBeUndefined();

			expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete media:', expect.any(Error));

			consoleErrorSpy.mockRestore();
		});

		it('should not call batchDelete when confirmation is rejected', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback.confirmBulkDelete.mockResolvedValue(false);
			component.selectedItems.set(new Set(['s1']));

			await component.deleteSelected();

			expect(mockCollection.batchDelete).not.toHaveBeenCalled();
			expect(component.selectedItems().size).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// editMedia - afterClosed callback
	// -----------------------------------------------------------------------

	describe('editMedia - afterClosed', () => {
		it('should reload media when dialog closes with updated=true', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			const afterClosedSubject = new Subject<{ updated: boolean } | undefined>();
			mockDialog.open.mockReturnValue({ afterClosed: afterClosedSubject.asObservable() });

			const media = validMedia({ id: 'edit-1' });
			component.editMedia(media);

			const findCallsBefore = mockCollection.find.mock.calls.length;

			afterClosedSubject.next({ updated: true });
			afterClosedSubject.complete();

			await vi.waitFor(() => {
				expect(mockCollection.find.mock.calls.length).toBeGreaterThan(findCallsBefore);
			});
		});

		it('should NOT reload media when dialog closes with updated=false', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			const afterClosedSubject = new Subject<{ updated: boolean } | undefined>();
			mockDialog.open.mockReturnValue({ afterClosed: afterClosedSubject.asObservable() });

			const media = validMedia({ id: 'edit-2' });
			component.editMedia(media);

			const findCallsBefore = mockCollection.find.mock.calls.length;

			afterClosedSubject.next({ updated: false });
			afterClosedSubject.complete();

			await new Promise((r) => setTimeout(r, 50));
			expect(mockCollection.find.mock.calls.length).toBe(findCallsBefore);
		});

		it('should NOT reload media when dialog closes with undefined result', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			const afterClosedSubject = new Subject<{ updated: boolean } | undefined>();
			mockDialog.open.mockReturnValue({ afterClosed: afterClosedSubject.asObservable() });

			const media = validMedia({ id: 'edit-3' });
			component.editMedia(media);

			const findCallsBefore = mockCollection.find.mock.calls.length;

			afterClosedSubject.next(undefined);
			afterClosedSubject.complete();

			await new Promise((r) => setTimeout(r, 50));
			expect(mockCollection.find.mock.calls.length).toBe(findCallsBefore);
		});
	});

	// -----------------------------------------------------------------------
	// getInputElement / onFilesSelected edge cases
	// -----------------------------------------------------------------------

	describe('onFilesSelected - getInputElement coverage', () => {
		it('should do nothing when event target is not HTMLInputElement', () => {
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: document.createElement('div') });
			expect(() => component.onFilesSelected(event)).not.toThrow();
		});

		it('should do nothing when files is null', () => {
			const input = document.createElement('input');
			input.type = 'file';
			Object.defineProperty(input, 'files', { value: null });
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: input });
			expect(() => component.onFilesSelected(event)).not.toThrow();
		});

		it('should do nothing when files list is empty (length 0)', () => {
			const input = document.createElement('input');
			input.type = 'file';
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: input });
			expect(() => component.onFilesSelected(event)).not.toThrow();
			expect(mockUpload.upload).not.toHaveBeenCalled();
		});

		it('should reset the input value after processing files', () => {
			const uploadSubject = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValue(uploadSubject.asObservable());

			const file = new File(['data'], 'reset-test.png', { type: 'image/png' });
			const event = createFileEvent([file]);
			const input = event.target as HTMLInputElement;

			component.onFilesSelected(event);

			expect(input.value).toBe('');
		});
	});

	// -----------------------------------------------------------------------
	// Multi-file upload
	// -----------------------------------------------------------------------

	describe('onFilesSelected - multiple files', () => {
		it('should create activeUploads for each file and call upload for each', () => {
			const subject1 = new Subject<UploadProgress>();
			const subject2 = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValueOnce(subject1.asObservable());
			mockUpload.upload.mockReturnValueOnce(subject2.asObservable());

			const file1 = new File(['a'], 'file1.jpg', { type: 'image/jpeg' });
			const file2 = new File(['b'], 'file2.png', { type: 'image/png' });

			component.onFilesSelected(createFileEvent([file1, file2]));

			expect(component.activeUploads().length).toBe(2);
			expect(mockUpload.upload).toHaveBeenCalledTimes(2);
			expect(mockUpload.upload).toHaveBeenCalledWith(file1);
			expect(mockUpload.upload).toHaveBeenCalledWith(file2);
		});

		it('should remove completed uploads individually', () => {
			const subject1 = new Subject<UploadProgress>();
			const subject2 = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValueOnce(subject1.asObservable());
			mockUpload.upload.mockReturnValueOnce(subject2.asObservable());

			const file1 = new File(['a'], 'file1.jpg', { type: 'image/jpeg' });
			const file2 = new File(['b'], 'file2.png', { type: 'image/png' });

			component.onFilesSelected(createFileEvent([file1, file2]));
			expect(component.activeUploads().length).toBe(2);

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
			expect(component.activeUploads().length).toBe(1);
			expect(component.activeUploads()[0].file.name).toBe('file2.png');
		});
	});

	// -----------------------------------------------------------------------
	// loadMedia - totalPages / totalDocs are properly set
	// -----------------------------------------------------------------------

	describe('loadMedia - sets totalPages and totalDocs', () => {
		it('should set totalPages from API response', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [],
				totalDocs: 48,
				totalPages: 2,
			});

			component.onSearchChange('pages-test');

			await vi.waitFor(() => {
				expect(component.totalDocs()).toBe(48);
				expect(component.totalPages()).toBe(2);
			});
		});
	});

	// -----------------------------------------------------------------------
	// onPageChange triggers loadMedia with correct page
	// -----------------------------------------------------------------------

	describe('onPageChange triggers loadMedia', () => {
		it('should call loadMedia with the new page number', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockCollection.find.mockResolvedValue({
				docs: [],
				totalDocs: 0,
				totalPages: 1,
			});

			component.onPageChange(3);

			await vi.waitFor(() => {
				const calls = mockCollection.find.mock.calls;
				const lastCall = calls[calls.length - 1]?.[0];
				expect(lastCall.page).toBe(3);
			});
		});
	});

	// -----------------------------------------------------------------------
	// toMediaItems edge case: non-array input
	// -----------------------------------------------------------------------

	describe('toMediaItems - via loadMedia with non-array docs', () => {
		it('should handle API returning non-array docs gracefully', async () => {
			mockCollection.find.mockResolvedValue({
				docs: 'not-an-array',
				totalDocs: 0,
				totalPages: 1,
			});

			component.onSearchChange('non-array');

			await vi.waitFor(() => {
				expect(component.mediaItems()).toEqual([]);
			});
		});

		it('should handle API returning null docs gracefully', async () => {
			mockCollection.find.mockResolvedValue({
				docs: null,
				totalDocs: 0,
				totalPages: 1,
			});

			component.onSearchChange('null-docs');

			await vi.waitFor(() => {
				expect(component.mediaItems()).toEqual([]);
			});
		});

		it('should handle API returning undefined docs gracefully', async () => {
			mockCollection.find.mockResolvedValue({
				totalDocs: 0,
				totalPages: 1,
			});

			component.onSearchChange('undef-docs');

			await vi.waitFor(() => {
				expect(component.mediaItems()).toEqual([]);
			});
		});
	});

	// -----------------------------------------------------------------------
	// isMediaItem edge cases covered through toMediaItems
	// -----------------------------------------------------------------------

	describe('isMediaItem type guard - edge cases via loadMedia', () => {
		it('should reject objects missing id', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [{ filename: 'no-id.jpg', mimeType: 'image/jpeg', path: '/p' }],
				totalDocs: 1,
				totalPages: 1,
			});

			component.onSearchChange('no-id');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(0);
			});
		});

		it('should reject objects missing filename', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [{ id: '1', mimeType: 'image/jpeg', path: '/p' }],
				totalDocs: 1,
				totalPages: 1,
			});

			component.onSearchChange('no-filename');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(0);
			});
		});

		it('should reject objects missing mimeType', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [{ id: '1', filename: 'a.jpg', path: '/p' }],
				totalDocs: 1,
				totalPages: 1,
			});

			component.onSearchChange('no-mime');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(0);
			});
		});

		it('should reject objects missing path', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [{ id: '1', filename: 'a.jpg', mimeType: 'image/jpeg' }],
				totalDocs: 1,
				totalPages: 1,
			});

			component.onSearchChange('no-path');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(0);
			});
		});

		it('should reject non-string id', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [{ id: 123, filename: 'a.jpg', mimeType: 'image/jpeg', path: '/p' }],
				totalDocs: 1,
				totalPages: 1,
			});

			component.onSearchChange('numeric-id');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(0);
			});
		});

		it('should reject null values in docs array', async () => {
			mockCollection.find.mockResolvedValue({
				docs: [null, undefined],
				totalDocs: 2,
				totalPages: 1,
			});

			component.onSearchChange('nulls');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(0);
			});
		});

		it('should accept valid MediaItem with optional fields', async () => {
			const doc = {
				id: 'full-1',
				filename: 'complete.jpg',
				mimeType: 'image/jpeg',
				path: 'uploads/complete.jpg',
				url: 'https://cdn.test.com/complete.jpg',
				filesize: 1024,
				alt: 'A complete image',
				width: 800,
				height: 600,
			};
			mockCollection.find.mockResolvedValue({
				docs: [doc],
				totalDocs: 1,
				totalPages: 1,
			});

			component.onSearchChange('full-item');

			await vi.waitFor(() => {
				expect(component.mediaItems().length).toBe(1);
				expect(component.mediaItems()[0].id).toBe('full-1');
				expect(component.mediaItems()[0].url).toBe('https://cdn.test.com/complete.jpg');
			});
		});
	});
});
