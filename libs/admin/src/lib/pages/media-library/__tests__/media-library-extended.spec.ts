/**
 * Extended tests for MediaLibraryPage covering methods that interact with
 * the API, upload service, feedback service, and dialog service.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { MediaLibraryPage } from '../media-library.page';
import { UploadService, type UploadProgress } from '../../../services/upload.service';
import { FeedbackService } from '../../../widgets/feedback/feedback.service';
import { ToastService, DialogService } from '@momentumcms/ui';

interface MediaItem {
	id: string;
	filename: string;
	mimeType: string;
	path: string;
	url?: string;
	filesize?: number;
}

class MockUploadService {
	upload = vi.fn();
	uploadToCollection = vi.fn();
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
	open = vi.fn().mockReturnValue({
		afterClosed: new Subject(),
	});
}

describe('MediaLibraryPage - extended', () => {
	let fixture: ComponentFixture<MediaLibraryPage>;
	let component: MediaLibraryPage;
	let mockUpload: MockUploadService;
	let mockFeedback: MockFeedbackService;
	let mockToast: MockToastService;
	let mockDialog: MockDialogService;
	let windowOpenSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
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
				{ provide: PLATFORM_ID, useValue: 'browser' },
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

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('viewMedia', () => {
		it('should open media URL in new tab', () => {
			const media: MediaItem = {
				id: '1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: 'uploads/photo.jpg',
				url: 'https://cdn.example.com/photo.jpg',
			};
			component.viewMedia(media);
			expect(windowOpenSpy).toHaveBeenCalledWith('https://cdn.example.com/photo.jpg', '_blank');
		});

		it('should use fallback URL when no url field', () => {
			const media: MediaItem = {
				id: '1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: 'uploads/photo.jpg',
			};
			component.viewMedia(media);
			expect(windowOpenSpy).toHaveBeenCalledWith('/api/media/file/uploads/photo.jpg', '_blank');
		});
	});

	describe('editMedia', () => {
		it('should open edit dialog with media data', () => {
			const media: MediaItem = {
				id: 'm1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: 'uploads/photo.jpg',
			};
			component.editMedia(media);
			expect(mockDialog.open).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					data: { media },
					width: '36rem',
				}),
			);
		});
	});

	describe('deleteMedia', () => {
		it('should not delete when not confirmed', async () => {
			mockFeedback.confirmDelete.mockResolvedValue(false);
			const media: MediaItem = {
				id: 'm1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: 'uploads/photo.jpg',
			};
			await component.deleteMedia(media);
			expect(mockFeedback.confirmDelete).toHaveBeenCalledWith('Media', 'photo.jpg');
		});
	});

	describe('deleteSelected', () => {
		it('should not delete when not confirmed', async () => {
			mockFeedback.confirmBulkDelete.mockResolvedValue(false);
			component.selectedItems.set(new Set(['m1', 'm2']));
			await component.deleteSelected();
			expect(mockFeedback.confirmBulkDelete).toHaveBeenCalledWith('Files', 2);
		});
	});

	describe('onFilesSelected with files', () => {
		function createFileEvent(file: File): Event {
			const fileList = {
				0: file,
				length: 1,
				item: (i: number) => (i === 0 ? file : null),
				[Symbol.iterator]: function* () {
					yield file;
				},
			} as unknown as FileList;
			const input = document.createElement('input');
			input.type = 'file';
			Object.defineProperty(input, 'files', { value: fileList, writable: false });
			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: input });
			return event;
		}

		it('should create active uploads and subscribe to upload service', () => {
			const uploadSubject = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValue(uploadSubject.asObservable());

			const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
			component.onFilesSelected(createFileEvent(file));

			expect(component.activeUploads().length).toBe(1);
			expect(component.activeUploads()[0].file).toBe(file);
			expect(mockUpload.upload).toHaveBeenCalledWith(file);
		});

		it('should update progress on upload next event', () => {
			const uploadSubject = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValue(uploadSubject.asObservable());

			const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
			component.onFilesSelected(createFileEvent(file));

			uploadSubject.next({ status: 'uploading', progress: 50, file });
			expect(component.activeUploads()[0].progress).toBe(50);
		});

		it('should remove upload on complete', () => {
			const uploadSubject = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValue(uploadSubject.asObservable());

			const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
			component.onFilesSelected(createFileEvent(file));

			uploadSubject.next({
				status: 'complete',
				progress: 100,
				file,
				result: {
					id: 'new-1',
					filename: 'test.jpg',
					mimeType: 'image/jpeg',
					path: 'uploads/test.jpg',
					createdAt: '2024-01-01T00:00:00Z',
					updatedAt: '2024-01-01T00:00:00Z',
				},
			});
			expect(component.activeUploads().length).toBe(0);
		});

		it('should show toast on upload error status', () => {
			const uploadSubject = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValue(uploadSubject.asObservable());

			const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
			component.onFilesSelected(createFileEvent(file));

			uploadSubject.next({
				status: 'error',
				progress: 0,
				file,
				error: 'Server error',
			});
			expect(component.activeUploads().length).toBe(0);
			expect(mockToast.error).toHaveBeenCalledWith(
				'Upload failed',
				expect.stringContaining('test.jpg'),
			);
		});

		it('should show toast on upload observable error', () => {
			const uploadSubject = new Subject<UploadProgress>();
			mockUpload.upload.mockReturnValue(uploadSubject.asObservable());

			const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
			component.onFilesSelected(createFileEvent(file));

			uploadSubject.error(new Error('Network failure'));
			expect(component.activeUploads().length).toBe(0);
			expect(mockToast.error).toHaveBeenCalledWith(
				'Upload failed',
				expect.stringContaining('Network failure'),
			);
		});
	});
});
