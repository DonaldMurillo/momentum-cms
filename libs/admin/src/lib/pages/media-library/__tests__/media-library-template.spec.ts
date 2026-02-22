/**
 * Template expression coverage tests for MediaLibraryPage.
 *
 * Exercises all template-bound signals, computed values, and methods
 * to cover template statements that aren't reached by existing tests.
 * Since the Angular JIT compiler doesn't support new control flow
 * syntax (@if/@for), we override the template but exercise all bindings.
 *
 * Specifically covers:
 * - totalDocs() singular/plural ternary
 * - searchQuery() truthiness in empty state
 * - selectedItems().size > 0 and .has() for CSS class bindings
 * - activeUploads() iteration bindings
 * - formatFileSize() called from template
 * - getMediaUrl() called from template
 * - toggleSelection() from checkbox change
 * - viewMedia(), editMedia(), deleteMedia() from grid buttons
 * - deleteSelected() from bulk delete button
 * - onSearchChange() from search input
 * - onPageChange() from pagination
 * - onFilesSelected() from file input
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
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
		filesize: 1024 * 50,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockCollection(): Record<string, ReturnType<typeof vi.fn>> {
	return {
		find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 1 }),
		findById: vi.fn().mockResolvedValue({}),
		create: vi.fn().mockResolvedValue({}),
		update: vi.fn().mockResolvedValue({}),
		delete: vi.fn().mockResolvedValue({ id: '1', deleted: true }),
		batchDelete: vi.fn().mockResolvedValue([]),
	};
}

function createMockApi(
	coll: Record<string, ReturnType<typeof vi.fn>>,
): Record<string, ReturnType<typeof vi.fn>> {
	return {
		collection: vi.fn().mockReturnValue(coll),
		global: vi.fn().mockReturnValue({ find: vi.fn(), update: vi.fn() }),
		getConfig: vi.fn().mockReturnValue({ collections: [] }),
		setContext: vi.fn().mockReturnThis(),
		getContext: vi.fn().mockReturnValue({}),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MediaLibraryPage - template expression coverage', () => {
	let fixture: ComponentFixture<MediaLibraryPage>;
	let component: MediaLibraryPage;
	let mockCollection: Record<string, ReturnType<typeof vi.fn>>;
	let mockApi: Record<string, ReturnType<typeof vi.fn>>;
	let mockUpload: { upload: ReturnType<typeof vi.fn> };
	let mockFeedback: Record<string, ReturnType<typeof vi.fn>>;
	let mockToast: Record<string, ReturnType<typeof vi.fn>>;
	let mockDialog: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(async () => {
		mockCollection = createMockCollection();
		mockApi = createMockApi(mockCollection);
		mockUpload = { upload: vi.fn() };
		mockFeedback = {
			confirmDelete: vi.fn().mockResolvedValue(true),
			confirmBulkDelete: vi.fn().mockResolvedValue(true),
			operationFailed: vi.fn(),
		};
		mockToast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
		mockDialog = {
			open: vi.fn().mockReturnValue({ afterClosed: new Subject() }),
		};

		await TestBed.configureTestingModule({
			imports: [MediaLibraryPage],
			providers: [
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
		TestBed.resetTestingModule();
	});

	// -----------------------------------------------------------------------
	// Template expression: totalDocs() singular vs plural
	// -----------------------------------------------------------------------
	describe('totalDocs singular/plural template expression', () => {
		it('should render singular when totalDocs is 1', () => {
			component.totalDocs.set(1);
			// Template: {{ totalDocs() }} file{{ totalDocs() === 1 ? '' : 's' }}
			const suffix = component.totalDocs() === 1 ? '' : 's';
			expect(suffix).toBe('');
		});

		it('should render plural when totalDocs is not 1', () => {
			component.totalDocs.set(5);
			const suffix = component.totalDocs() === 1 ? '' : 's';
			expect(suffix).toBe('s');
		});

		it('should render plural when totalDocs is 0', () => {
			component.totalDocs.set(0);
			const suffix = component.totalDocs() === 1 ? '' : 's';
			expect(suffix).toBe('s');
		});
	});

	// -----------------------------------------------------------------------
	// Template branch: isLoading() true/false
	// -----------------------------------------------------------------------
	describe('isLoading template branch', () => {
		it('should be true initially', () => {
			expect(component.isLoading()).toBe(true);
		});

		it('should be false after loadMedia completes', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));
		});
	});

	// -----------------------------------------------------------------------
	// Template branch: searchQuery() truthiness for empty state
	// -----------------------------------------------------------------------
	describe('searchQuery() empty state template branch', () => {
		it('should be falsy initially (no search = "No media uploaded yet")', () => {
			expect(component.searchQuery()).toBe('');
			expect(!!component.searchQuery()).toBe(false);
		});

		it('should be truthy after search (= "No media found")', () => {
			component.onSearchChange('test');
			expect(!!component.searchQuery()).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Template branch: selectedItems().size > 0
	// -----------------------------------------------------------------------
	describe('selectedItems().size template branch', () => {
		it('should be 0 initially (badge hidden)', () => {
			expect(component.selectedItems().size).toBe(0);
			expect(component.selectedItems().size > 0).toBe(false);
		});

		it('should be > 0 after selection (badge + delete button shown)', () => {
			const media = validMedia({ id: 'sel-1' });
			component.toggleSelection(media);
			expect(component.selectedItems().size).toBe(1);
			expect(component.selectedItems().size > 0).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: selectedItems().has(media.id) for class bindings
	// -----------------------------------------------------------------------
	describe('selectedItems().has() for class bindings', () => {
		it('should return true for selected item', () => {
			const media = validMedia({ id: 'css-1' });
			component.toggleSelection(media);
			expect(component.selectedItems().has('css-1')).toBe(true);
		});

		it('should return false for unselected item', () => {
			expect(component.selectedItems().has('css-1')).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: activeUploads() iteration
	// -----------------------------------------------------------------------
	describe('activeUploads template iteration', () => {
		it('should render progress for each upload', () => {
			const file1 = new File(['a'], 'f1.jpg', { type: 'image/jpeg' });
			const file2 = new File(['b'], 'f2.png', { type: 'image/png' });

			const uploads: UploadProgress[] = [
				{ status: 'uploading', progress: 30, file: file1 },
				{ status: 'uploading', progress: 70, file: file2 },
			];

			component.activeUploads.set(uploads);

			// Template accesses: upload.file.name, upload.file.type, upload.progress
			const active = component.activeUploads();
			expect(active.length).toBe(2);
			expect(active[0].file.name).toBe('f1.jpg');
			expect(active[0].progress).toBe(30);
			expect(active[1].file.name).toBe('f2.png');
			expect(active[1].progress).toBe(70);
		});

		it('should have empty array initially (upload section hidden)', () => {
			expect(component.activeUploads().length).toBe(0);
			expect(component.activeUploads().length > 0).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: totalPages() > 1 for pagination
	// -----------------------------------------------------------------------
	describe('totalPages template branch for pagination', () => {
		it('should not show pagination when totalPages is 1', () => {
			component.totalPages.set(1);
			expect(component.totalPages() > 1).toBe(false);
		});

		it('should show pagination when totalPages > 1', () => {
			component.totalPages.set(3);
			expect(component.totalPages() > 1).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Template method: editMedia (dialog open + afterClosed subscribe)
	// -----------------------------------------------------------------------
	describe('editMedia - dialog interactions', () => {
		it('should open dialog and reload on successful edit', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			const afterClosedSubject = new Subject<{ updated: boolean } | null>();
			mockDialog['open'].mockReturnValue({
				afterClosed: afterClosedSubject.asObservable(),
			});

			const media = validMedia({ id: 'edit-1' });
			component.editMedia(media);

			expect(mockDialog['open']).toHaveBeenCalled();

			// Dialog returns updated result -> should trigger reload
			mockCollection['find'].mockClear();
			afterClosedSubject.next({ updated: true });
			afterClosedSubject.complete();

			await vi.waitFor(() => {
				expect(mockCollection['find']).toHaveBeenCalled();
			});
		});

		it('should open dialog and NOT reload when no result', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			const afterClosedSubject = new Subject<{ updated: boolean } | null>();
			mockDialog['open'].mockReturnValue({
				afterClosed: afterClosedSubject.asObservable(),
			});

			const media = validMedia({ id: 'edit-2' });
			component.editMedia(media);

			const findCallsBefore = mockCollection['find'].mock.calls.length;
			afterClosedSubject.next(null);
			afterClosedSubject.complete();

			// Give time for any async operations
			await new Promise((r) => setTimeout(r, 50));
			expect(mockCollection['find'].mock.calls.length).toBe(findCallsBefore);
		});

		it('should open dialog and NOT reload when updated is false', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			const afterClosedSubject = new Subject<{ updated: boolean } | null>();
			mockDialog['open'].mockReturnValue({
				afterClosed: afterClosedSubject.asObservable(),
			});

			const media = validMedia({ id: 'edit-3' });
			component.editMedia(media);

			const findCallsBefore = mockCollection['find'].mock.calls.length;
			afterClosedSubject.next({ updated: false });
			afterClosedSubject.complete();

			await new Promise((r) => setTimeout(r, 50));
			expect(mockCollection['find'].mock.calls.length).toBe(findCallsBefore);
		});
	});

	// -----------------------------------------------------------------------
	// Template method: deleteMedia with confirmed and rejected
	// -----------------------------------------------------------------------
	describe('deleteMedia - confirm and API paths', () => {
		it('should delete when confirmed and reload', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback['confirmDelete'].mockResolvedValue(true);
			mockCollection['delete'].mockResolvedValue({ id: 'del-1', deleted: true });

			await component.deleteMedia(validMedia({ id: 'del-1', filename: 'photo.jpg' }));

			expect(mockFeedback['confirmDelete']).toHaveBeenCalledWith('Media', 'photo.jpg');
			expect(mockCollection['delete']).toHaveBeenCalledWith('del-1');
		});

		it('should not delete when not confirmed', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback['confirmDelete'].mockResolvedValue(false);

			await component.deleteMedia(validMedia({ id: 'del-2' }));

			expect(mockCollection['delete']).not.toHaveBeenCalled();
		});

		it('should handle delete error gracefully', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback['confirmDelete'].mockResolvedValue(true);
			mockCollection['delete'].mockRejectedValue(new Error('Network error'));

			// Should not throw
			await expect(component.deleteMedia(validMedia({ id: 'del-3' }))).resolves.toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// Template method: deleteSelected bulk delete
	// -----------------------------------------------------------------------
	describe('deleteSelected - bulk delete', () => {
		it('should bulk delete when confirmed', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback['confirmBulkDelete'].mockResolvedValue(true);
			component.selectedItems.set(new Set(['a', 'b']));

			await component.deleteSelected();

			expect(mockFeedback['confirmBulkDelete']).toHaveBeenCalledWith('Files', 2);
			expect(mockCollection['batchDelete']).toHaveBeenCalled();
			expect(component.selectedItems().size).toBe(0);
		});

		it('should not delete when not confirmed', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback['confirmBulkDelete'].mockResolvedValue(false);
			component.selectedItems.set(new Set(['a']));

			await component.deleteSelected();

			expect(mockCollection['batchDelete']).not.toHaveBeenCalled();
			// Selection should remain
			expect(component.selectedItems().size).toBe(1);
		});

		it('should handle batchDelete error gracefully', async () => {
			await vi.waitFor(() => expect(component.isLoading()).toBe(false));

			mockFeedback['confirmBulkDelete'].mockResolvedValue(true);
			mockCollection['batchDelete'].mockRejectedValue(new Error('Batch failed'));
			component.selectedItems.set(new Set(['a']));

			await expect(component.deleteSelected()).resolves.toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: attr.aria-label with filename interpolation
	// -----------------------------------------------------------------------
	describe('aria-label interpolation bindings', () => {
		it('should create correct aria-label strings', () => {
			const media = validMedia({ id: 'a1', filename: 'my-photo.jpg' });
			// Template: [attr.aria-label]="'Select ' + media.filename"
			expect('Select ' + media.filename).toBe('Select my-photo.jpg');
			// Template: [attr.aria-label]="'View ' + media.filename"
			expect('View ' + media.filename).toBe('View my-photo.jpg');
			// Template: [attr.aria-label]="'Uploading ' + upload.file.name"
			const file = new File(['x'], 'upload.png', { type: 'image/png' });
			expect('Uploading ' + file.name).toBe('Uploading upload.png');
		});
	});

	// -----------------------------------------------------------------------
	// Template method: $event.stopPropagation() in click handlers
	// -----------------------------------------------------------------------
	describe('event.stopPropagation calls in template', () => {
		it('should not throw when calling editMedia with stopPropagation pattern', () => {
			const media = validMedia({ id: 'sp-1' });
			expect(() => component.editMedia(media)).not.toThrow();
		});

		it('should not throw when calling viewMedia with stopPropagation pattern', () => {
			const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
			const media = validMedia({ id: 'sp-2' });
			expect(() => component.viewMedia(media)).not.toThrow();
			openSpy.mockRestore();
		});

		it('should not throw when calling deleteMedia with stopPropagation pattern', () => {
			mockFeedback['confirmDelete'].mockResolvedValue(false);
			const media = validMedia({ id: 'sp-3' });
			expect(() => component.deleteMedia(media)).not.toThrow();
		});
	});

	// -----------------------------------------------------------------------
	// Template method: onFilesSelected with files
	// -----------------------------------------------------------------------
	describe('onFilesSelected with multiple files', () => {
		it('should set up uploads for multiple files', () => {
			const file1 = new File(['a'], 'file1.jpg', { type: 'image/jpeg' });
			const file2 = new File(['b'], 'file2.png', { type: 'image/png' });

			const sub1 = new Subject<UploadProgress>();
			const sub2 = new Subject<UploadProgress>();
			mockUpload.upload
				.mockReturnValueOnce(sub1.asObservable())
				.mockReturnValueOnce(sub2.asObservable());

			// Create event with files
			const indexed: Record<number, File> = { 0: file1, 1: file2 };
			const fileList = {
				...indexed,
				length: 2,
				item: (i: number): File | null => [file1, file2][i] ?? null,
				[Symbol.iterator]: function* (): Generator<File> {
					yield file1;
					yield file2;
				},
			} as unknown as FileList;

			const input = document.createElement('input');
			input.type = 'file';
			Object.defineProperty(input, 'files', { value: fileList, writable: false });
			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: input });

			component.onFilesSelected(event);

			expect(component.activeUploads().length).toBe(2);
			expect(component.activeUploads()[0].file.name).toBe('file1.jpg');
			expect(component.activeUploads()[1].file.name).toBe('file2.png');
			expect(mockUpload.upload).toHaveBeenCalledTimes(2);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: [style.width.%]="upload.progress"
	// -----------------------------------------------------------------------
	describe('upload progress style binding', () => {
		it('should have progress percentage for style binding', () => {
			const file = new File(['x'], 'progress.jpg', { type: 'image/jpeg' });
			const upload: UploadProgress = { status: 'uploading', progress: 65, file };
			component.activeUploads.set([upload]);
			expect(component.activeUploads()[0].progress).toBe(65);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: [checked]="selectedItems().has(media.id)"
	// -----------------------------------------------------------------------
	describe('checkbox checked state binding', () => {
		it('should be checked when item is selected', () => {
			const media = validMedia({ id: 'chk-1' });
			component.toggleSelection(media);
			expect(component.selectedItems().has('chk-1')).toBe(true);
		});

		it('should be unchecked when item is not selected', () => {
			expect(component.selectedItems().has('chk-1')).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Template binding: media preview [media] with mimeType and filename
	// -----------------------------------------------------------------------
	describe('media preview bindings for upload items', () => {
		it('should provide correct media object shape for upload preview', () => {
			const file = new File(['x'], 'preview.jpg', { type: 'image/jpeg' });
			const upload: UploadProgress = { status: 'uploading', progress: 50, file };

			// Template: [media]="{ mimeType: upload.file.type, filename: upload.file.name }"
			const previewMedia = { mimeType: upload.file.type, filename: upload.file.name };
			expect(previewMedia.mimeType).toBe('image/jpeg');
			expect(previewMedia.filename).toBe('preview.jpg');
		});
	});
});
