/**
 * Upload Field Renderer tests.
 * Tests file validation, upload flow, drag & drop, media picker, and computed signals.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { UploadFieldRenderer } from '../upload-field.component';
import { UploadService, type UploadProgress } from '../../../../services/upload.service';
import { DialogService } from '@momentumcms/ui';
import type { Field, UploadField } from '@momentumcms/core';
import { createMockFieldNodeState } from './test-helpers';

function createUploadField(overrides?: Partial<UploadField>): Field {
	return {
		name: 'coverImage',
		type: 'upload',
		label: 'Cover Image',
		required: false,
		relationTo: 'media',
		...overrides,
	} as unknown as Field;
}

function createMockFile(name: string, type: string, size: number): File {
	const content = new Uint8Array(size);
	return new File([content], name, { type });
}

class MockUploadService {
	uploadSubject = new Subject<UploadProgress>();
	upload = vi.fn().mockReturnValue(this.uploadSubject.asObservable());
	uploadToCollection = vi.fn().mockReturnValue(this.uploadSubject.asObservable());
}

class MockDialogService {
	afterClosedSubject = new Subject<unknown>();
	open = vi.fn().mockReturnValue({
		afterClosed: this.afterClosedSubject.asObservable(),
	});
}

describe('UploadFieldRenderer', () => {
	let fixture: ComponentFixture<UploadFieldRenderer>;
	let component: UploadFieldRenderer;
	let mockUpload: MockUploadService;
	let mockDialog: MockDialogService;

	function setup(
		fieldOverrides?: Partial<UploadField>,
		initialValue?: unknown,
		mode = 'create',
	): { state: ReturnType<typeof createMockFieldNodeState> } {
		const field = createUploadField(fieldOverrides);
		const mock = createMockFieldNodeState(initialValue ?? null);

		fixture = TestBed.createComponent(UploadFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('field', field);
		fixture.componentRef.setInput('path', 'coverImage');
		fixture.componentRef.setInput('mode', mode);
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();

		return { state: mock };
	}

	beforeEach(async () => {
		mockUpload = new MockUploadService();
		mockDialog = new MockDialogService();

		await TestBed.configureTestingModule({
			imports: [UploadFieldRenderer],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: UploadService, useValue: mockUpload },
				{ provide: DialogService, useValue: mockDialog },
			],
		}).compileComponents();
	});

	it('should create', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('fieldId', () => {
		it('should generate id from path', () => {
			setup();
			expect(component.fieldId()).toBe('field-coverImage');
		});

		it('should replace dots with dashes', () => {
			setup();
			fixture.componentRef.setInput('path', 'blocks.0.image');
			expect(component.fieldId()).toBe('field-blocks-0-image');
		});
	});

	describe('label', () => {
		it('should use field label', () => {
			setup({ label: 'Hero Image' });
			expect(component.label()).toBe('Hero Image');
		});

		it('should fallback to humanized field name', () => {
			setup({ label: undefined });
			expect(component.label()).toBe('Cover Image');
		});
	});

	describe('required', () => {
		it('should read required from field', () => {
			setup({ required: true });
			expect(component.required()).toBe(true);
		});

		it('should default to false', () => {
			setup({ required: undefined });
			expect(component.required()).toBe(false);
		});
	});

	describe('isDisabled', () => {
		it('should be false in create mode', () => {
			setup({}, null, 'create');
			expect(component.isDisabled()).toBe(false);
		});

		it('should be false in edit mode', () => {
			setup({}, null, 'edit');
			expect(component.isDisabled()).toBe(false);
		});

		it('should be true in view mode', () => {
			setup({}, null, 'view');
			expect(component.isDisabled()).toBe(true);
		});

		it('should be true when field is readOnly', () => {
			setup({ admin: { readOnly: true } } as Partial<UploadField>);
			expect(component.isDisabled()).toBe(true);
		});
	});

	describe('hasValue', () => {
		it('should be false when value is null', () => {
			setup({}, null);
			expect(component.hasValue()).toBe(false);
		});

		it('should be false when value is empty string', () => {
			setup({}, '');
			expect(component.hasValue()).toBe(false);
		});

		it('should be true when value is an object', () => {
			setup({}, { id: '123', filename: 'photo.jpg' });
			expect(component.hasValue()).toBe(true);
		});

		it('should be true when value is a string ID', () => {
			setup({}, 'media-123');
			expect(component.hasValue()).toBe(true);
		});
	});

	describe('mediaPreviewData', () => {
		it('should return null when no value', () => {
			setup({}, null);
			expect(component.mediaPreviewData()).toBeNull();
		});

		it('should extract preview data from object value', () => {
			setup(
				{},
				{
					url: 'https://cdn.example.com/photo.jpg',
					path: 'uploads/photo.jpg',
					mimeType: 'image/jpeg',
					filename: 'photo.jpg',
					alt: 'A photo',
				},
			);
			const preview = component.mediaPreviewData();
			expect(preview).toEqual({
				url: 'https://cdn.example.com/photo.jpg',
				path: 'uploads/photo.jpg',
				mimeType: 'image/jpeg',
				filename: 'photo.jpg',
				alt: 'A photo',
			});
		});

		it('should return null when value is a number', () => {
			setup({}, 42);
			expect(component.mediaPreviewData()).toBeNull();
		});
	});

	describe('mediaFilename', () => {
		it('should return filename from object value', () => {
			setup({}, { filename: 'photo.jpg' });
			expect(component.mediaFilename()).toBe('photo.jpg');
		});

		it('should return "Selected media" when no filename property', () => {
			setup({}, { id: '123' });
			expect(component.mediaFilename()).toBe('Selected media');
		});

		it('should return "Selected media" when value is not an object', () => {
			setup({}, null);
			expect(component.mediaFilename()).toBe('Selected media');
		});
	});

	describe('mimeTypesHint', () => {
		it('should return null when no mimeTypes', () => {
			setup({ mimeTypes: undefined });
			expect(component.mimeTypesHint()).toBeNull();
		});

		it('should return null when mimeTypes is empty', () => {
			setup({ mimeTypes: [] });
			expect(component.mimeTypesHint()).toBeNull();
		});

		it('should simplify image/* to Images', () => {
			setup({ mimeTypes: ['image/*'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Images');
		});

		it('should simplify video/* to Videos', () => {
			setup({ mimeTypes: ['video/*'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Videos');
		});

		it('should simplify audio/* to Audio', () => {
			setup({ mimeTypes: ['audio/*'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Audio');
		});

		it('should simplify application/pdf to PDF', () => {
			setup({ mimeTypes: ['application/pdf'] });
			expect(component.mimeTypesHint()).toBe('Allowed: PDF');
		});

		it('should combine multiple mime types', () => {
			setup({ mimeTypes: ['image/*', 'application/pdf'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Images, PDF');
		});

		it('should pass through unknown mime types', () => {
			setup({ mimeTypes: ['text/csv'] });
			expect(component.mimeTypesHint()).toBe('Allowed: text/csv');
		});
	});

	describe('maxSizeHint', () => {
		it('should return null when no maxSize', () => {
			setup({ maxSize: undefined });
			expect(component.maxSizeHint()).toBeNull();
		});

		it('should format bytes', () => {
			setup({ maxSize: 500 });
			expect(component.maxSizeHint()).toBe('500 bytes');
		});

		it('should format KB', () => {
			setup({ maxSize: 2048 });
			expect(component.maxSizeHint()).toBe('2.0 KB');
		});

		it('should format MB', () => {
			setup({ maxSize: 5 * 1024 * 1024 });
			expect(component.maxSizeHint()).toBe('5.0 MB');
		});

		it('should format GB', () => {
			setup({ maxSize: 2 * 1024 * 1024 * 1024 });
			expect(component.maxSizeHint()).toBe('2.0 GB');
		});
	});

	describe('acceptAttribute', () => {
		it('should return */* when no mimeTypes', () => {
			setup({ mimeTypes: undefined });
			expect(component.acceptAttribute()).toBe('*/*');
		});

		it('should return */* when mimeTypes is empty', () => {
			setup({ mimeTypes: [] });
			expect(component.acceptAttribute()).toBe('*/*');
		});

		it('should join mimeTypes with commas', () => {
			setup({ mimeTypes: ['image/*', 'application/pdf'] });
			expect(component.acceptAttribute()).toBe('image/*,application/pdf');
		});
	});

	describe('touchedErrors', () => {
		it('should return empty array when no formNode', () => {
			fixture = TestBed.createComponent(UploadFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createUploadField());
			fixture.componentRef.setInput('path', 'coverImage');
			fixture.detectChanges();
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should return empty array when not touched', () => {
			setup();
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should return errors when touched', () => {
			const mock = createMockFieldNodeState(null, {
				touched: true,
				errors: [{ kind: 'required', message: 'Field is required' }],
			});

			fixture = TestBed.createComponent(UploadFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createUploadField());
			fixture.componentRef.setInput('path', 'coverImage');
			fixture.componentRef.setInput('formNode', mock.node);
			fixture.detectChanges();

			expect(component.touchedErrors()).toEqual([
				{ kind: 'required', message: 'Field is required' },
			]);
		});
	});

	describe('file validation — MIME type', () => {
		it('should reject a file whose type is not in the allowed mimeTypes', () => {
			setup({ mimeTypes: ['image/*'] });
			const file = createMockFile('doc.pdf', 'application/pdf', 1024);

			component.uploadFile(file);

			expect(component.uploadError()).toBe('File type "application/pdf" is not allowed');
			expect(component.isUploading()).toBe(false);
		});

		it('should accept a file matching a wildcard mime type', () => {
			setup({ mimeTypes: ['image/*'] });
			const file = createMockFile('photo.png', 'image/png', 1024);

			component.uploadFile(file);

			expect(component.uploadError()).toBeNull();
			expect(component.isUploading()).toBe(true);
		});

		it('should accept a file matching an exact mime type', () => {
			setup({ mimeTypes: ['application/pdf'] });
			const file = createMockFile('doc.pdf', 'application/pdf', 1024);

			component.uploadFile(file);

			expect(component.uploadError()).toBeNull();
			expect(component.isUploading()).toBe(true);
		});

		it('should accept any file when mimeTypes is not set', () => {
			setup({ mimeTypes: undefined });
			const file = createMockFile('data.csv', 'text/csv', 1024);

			component.uploadFile(file);

			expect(component.uploadError()).toBeNull();
		});

		it('should accept any file when mimeTypes is empty', () => {
			setup({ mimeTypes: [] });
			const file = createMockFile('anything.bin', 'application/octet-stream', 512);

			component.uploadFile(file);

			expect(component.uploadError()).toBeNull();
		});
	});

	describe('file validation — file size', () => {
		it('should reject a file exceeding maxSize', () => {
			setup({ maxSize: 1024 });
			const file = createMockFile('big.png', 'image/png', 2048);

			component.uploadFile(file);

			expect(component.uploadError()).toContain('File size exceeds maximum');
			expect(component.isUploading()).toBe(false);
		});

		it('should accept a file within maxSize', () => {
			setup({ maxSize: 2048 });
			const file = createMockFile('small.png', 'image/png', 1024);

			component.uploadFile(file);

			expect(component.uploadError()).toBeNull();
			expect(component.isUploading()).toBe(true);
		});

		it('should accept any size when maxSize is not set', () => {
			setup({ maxSize: undefined });
			const file = createMockFile('huge.bin', 'application/octet-stream', 100_000_000);

			component.uploadFile(file);

			expect(component.uploadError()).toBeNull();
		});
	});

	describe('upload flow', () => {
		it('should set uploading state when starting upload', () => {
			setup();
			const file = createMockFile('photo.jpg', 'image/jpeg', 4096);

			component.uploadFile(file);

			expect(component.isUploading()).toBe(true);
			expect(component.uploadProgress()).toBe(0);
			expect(component.uploadingFilename()).toBe('photo.jpg');
			expect(component.uploadingFile()).toBe(file);
			expect(component.uploadError()).toBeNull();
		});

		it('should clear previous error when starting new upload', () => {
			setup();
			component.uploadError.set('Previous error');

			const file = createMockFile('photo.jpg', 'image/jpeg', 4096);
			component.uploadFile(file);

			expect(component.uploadError()).toBeNull();
		});

		it('should call uploadService.uploadToCollection with correct args', () => {
			setup({ relationTo: 'documents' });
			const file = createMockFile('report.pdf', 'application/pdf', 2048);

			component.uploadFile(file);

			expect(mockUpload.uploadToCollection).toHaveBeenCalledWith('documents', file);
		});

		it('should update progress on uploading event', () => {
			setup();
			const file = createMockFile('photo.jpg', 'image/jpeg', 4096);
			component.uploadFile(file);

			mockUpload.uploadSubject.next({
				status: 'uploading',
				progress: 50,
				file,
			});

			expect(component.uploadProgress()).toBe(50);
		});

		it('should complete upload and set value on formNode', () => {
			const { state: mock } = setup();
			const file = createMockFile('photo.jpg', 'image/jpeg', 4096);
			component.uploadFile(file);

			const resultDoc = {
				id: 'media-1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: '/uploads/photo.jpg',
				createdAt: '2026-01-01T00:00:00Z',
				updatedAt: '2026-01-01T00:00:00Z',
			};

			mockUpload.uploadSubject.next({
				status: 'complete',
				progress: 100,
				file,
				result: resultDoc,
			});

			expect(component.isUploading()).toBe(false);
			expect(component.uploadingFile()).toBeNull();
			expect(mock.state.value()).toEqual(resultDoc);
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});

		it('should handle upload error from progress event', () => {
			setup();
			const file = createMockFile('photo.jpg', 'image/jpeg', 4096);
			component.uploadFile(file);

			mockUpload.uploadSubject.next({
				status: 'error',
				progress: 0,
				file,
				error: 'Server rejected the file',
			});

			expect(component.isUploading()).toBe(false);
			expect(component.uploadingFile()).toBeNull();
			expect(component.uploadError()).toBe('Server rejected the file');
		});

		it('should use default error message when error has no message', () => {
			setup();
			const file = createMockFile('photo.jpg', 'image/jpeg', 4096);
			component.uploadFile(file);

			mockUpload.uploadSubject.next({
				status: 'error',
				progress: 0,
				file,
			});

			expect(component.uploadError()).toBe('Upload failed');
		});

		it('should handle observable error', () => {
			setup();
			const file = createMockFile('photo.jpg', 'image/jpeg', 4096);
			component.uploadFile(file);

			mockUpload.uploadSubject.error(new Error('Network failure'));

			expect(component.isUploading()).toBe(false);
			expect(component.uploadingFile()).toBeNull();
			expect(component.uploadError()).toBe('Network failure');
		});
	});

	describe('drag and drop', () => {
		function createDragEvent(type: string, files?: File[]): DragEvent {
			const event = new Event(type, { bubbles: true, cancelable: true });
			Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
			Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });

			if (files) {
				const dataTransfer = {
					files: {
						0: files[0],
						length: files.length,
						item: (index: number) => files[index] ?? null,
					},
				};
				Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
			}

			return event as unknown as DragEvent;
		}

		it('should set isDragging on dragover when not disabled', () => {
			setup();
			const event = createDragEvent('dragover');

			component.onDragOver(event);

			expect(component.isDragging()).toBe(true);
			expect(event.preventDefault).toHaveBeenCalled();
			expect(event.stopPropagation).toHaveBeenCalled();
		});

		it('should not set isDragging on dragover when disabled', () => {
			setup({}, null, 'view');
			const event = createDragEvent('dragover');

			component.onDragOver(event);

			expect(component.isDragging()).toBe(false);
		});

		it('should set isDragging to false on dragleave', () => {
			setup();
			component.isDragging.set(true);
			const event = createDragEvent('dragleave');

			component.onDragLeave(event);

			expect(component.isDragging()).toBe(false);
		});

		it('should upload file on drop', () => {
			setup();
			const file = createMockFile('dropped.png', 'image/png', 2048);
			const event = createDragEvent('drop', [file]);

			component.onDrop(event);

			expect(component.isDragging()).toBe(false);
			expect(component.isUploading()).toBe(true);
			expect(component.uploadingFilename()).toBe('dropped.png');
		});

		it('should not upload on drop when disabled', () => {
			setup({}, null, 'view');
			const file = createMockFile('dropped.png', 'image/png', 2048);
			const event = createDragEvent('drop', [file]);

			component.onDrop(event);

			expect(component.isUploading()).toBe(false);
		});

		it('should not upload on drop when no files in dataTransfer', () => {
			setup();
			const event = createDragEvent('drop');

			component.onDrop(event);

			expect(component.isUploading()).toBe(false);
		});
	});

	describe('triggerFileInput', () => {
		it('should not throw when disabled', () => {
			setup({}, null, 'view');
			expect(() => component.triggerFileInput()).not.toThrow();
		});

		it('should not throw when fileInputRef is undefined', () => {
			setup();
			expect(() => component.triggerFileInput()).not.toThrow();
		});
	});

	describe('onDropZoneSpace', () => {
		it('should prevent default and call triggerFileInput', () => {
			setup();
			const event = new Event('keydown');
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
			const triggerSpy = vi.spyOn(component, 'triggerFileInput');

			component.onDropZoneSpace(event);

			expect(preventDefaultSpy).toHaveBeenCalled();
			expect(triggerSpy).toHaveBeenCalled();
		});
	});

	describe('onFileSelected', () => {
		it('should upload a file from input change event', () => {
			setup();
			const file = createMockFile('selected.jpg', 'image/jpeg', 3072);
			const realInput = document.createElement('input');
			realInput.type = 'file';
			Object.defineProperty(realInput, 'files', {
				get: () => ({
					0: file,
					length: 1,
					item: () => file,
				}),
			});
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: realInput });

			component.onFileSelected(event);

			expect(component.isUploading()).toBe(true);
			expect(component.uploadingFilename()).toBe('selected.jpg');
		});

		it('should do nothing when target is not HTMLInputElement', () => {
			setup();
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: document.createElement('div') });

			component.onFileSelected(event);

			expect(component.isUploading()).toBe(false);
		});

		it('should do nothing when input has no files', () => {
			setup();
			const input = document.createElement('input');
			input.type = 'file';
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: input });

			component.onFileSelected(event);

			expect(component.isUploading()).toBe(false);
		});
	});

	describe('openMediaPicker', () => {
		it('should open dialog with DialogService', () => {
			setup({ mimeTypes: ['image/*'], relationTo: 'media' });

			component.openMediaPicker();

			expect(mockDialog.open).toHaveBeenCalled();
		});

		it('should set value on formNode when media is selected', () => {
			const { state: mock } = setup();
			component.openMediaPicker();

			const selectedMedia = {
				id: 'media-42',
				filename: 'chosen.png',
				mimeType: 'image/png',
				path: '/uploads/chosen.png',
			};

			mockDialog.afterClosedSubject.next({ media: selectedMedia });

			expect(mock.state.value()).toEqual(selectedMedia);
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});

		it('should not set value when dialog is closed without selection', () => {
			const { state: mock } = setup({}, null);
			component.openMediaPicker();

			mockDialog.afterClosedSubject.next(undefined);

			expect(mock.state.value()).toBeNull();
		});

		it('should not set value when dialog returns null media', () => {
			const { state: mock } = setup({}, null);
			component.openMediaPicker();

			mockDialog.afterClosedSubject.next({ media: null });

			expect(mock.state.value()).toBeNull();
		});
	});

	describe('removeMedia', () => {
		it('should set value to null on formNode', () => {
			const { state: mock } = setup({}, { id: '123', filename: 'old.png' });

			component.removeMedia();

			expect(mock.state.value()).toBeNull();
		});

		it('should do nothing when formNode is null', () => {
			fixture = TestBed.createComponent(UploadFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createUploadField());
			fixture.componentRef.setInput('path', 'coverImage');
			fixture.detectChanges();

			expect(() => component.removeMedia()).not.toThrow();
		});
	});

	describe('uploadField computed', () => {
		it('should return field as UploadField when type is upload', () => {
			setup({ relationTo: 'assets' });
			expect(component.uploadField().relationTo).toBe('assets');
		});

		it('should return minimal UploadField when type is not upload', () => {
			const nonUploadField = { name: 'avatar', type: 'text', label: 'Avatar' } as unknown as Field;
			fixture = TestBed.createComponent(UploadFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', nonUploadField);
			fixture.componentRef.setInput('path', 'avatar');
			fixture.detectChanges();
			expect(component.uploadField().relationTo).toBe('media');
		});
	});

	describe('edge cases', () => {
		it('should handle upload with 0-byte file', () => {
			setup();
			const file = createMockFile('empty.txt', 'text/plain', 0);

			component.uploadFile(file);

			expect(component.isUploading()).toBe(true);
			expect(component.uploadingFilename()).toBe('empty.txt');
		});

		it('should reset error between uploads', () => {
			setup({ mimeTypes: ['image/*'] });

			const badFile = createMockFile('bad.pdf', 'application/pdf', 100);
			component.uploadFile(badFile);
			expect(component.uploadError()).toBeTruthy();

			const goodFile = createMockFile('good.png', 'image/png', 100);
			component.uploadFile(goodFile);
			expect(component.uploadError()).toBeNull();
		});
	});
});
