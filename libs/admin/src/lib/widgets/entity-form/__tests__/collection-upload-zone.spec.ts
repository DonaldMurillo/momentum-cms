import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionUploadZoneComponent } from '../collection-upload-zone.component';

describe('CollectionUploadZoneComponent', () => {
	let fixture: ComponentFixture<CollectionUploadZoneComponent>;
	let component: CollectionUploadZoneComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CollectionUploadZoneComponent],
		})
			.overrideComponent(CollectionUploadZoneComponent, {
				set: { template: '<div><input #fileInput type="file" /></div>', imports: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(CollectionUploadZoneComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('default values', () => {
		it('should not be disabled', () => {
			expect(component.disabled()).toBe(false);
		});

		it('should have no pending file', () => {
			expect(component.pendingFile()).toBeNull();
		});

		it('should not be uploading', () => {
			expect(component.isUploading()).toBe(false);
		});

		it('should have 0 upload progress', () => {
			expect(component.uploadProgress()).toBe(0);
		});

		it('should have no error', () => {
			expect(component.error()).toBeNull();
		});

		it('should have no existing media', () => {
			expect(component.existingMedia()).toBeNull();
		});

		it('should not be dragging', () => {
			expect(component.isDragging()).toBe(false);
		});
	});

	describe('formatFileSize', () => {
		it('should format bytes', () => {
			expect(component.formatFileSize(512)).toBe('512 bytes');
		});

		it('should format KB', () => {
			expect(component.formatFileSize(1024 * 10)).toBe('10.0 KB');
		});

		it('should format MB', () => {
			expect(component.formatFileSize(1024 * 1024 * 3)).toBe('3.0 MB');
		});

		it('should format GB', () => {
			expect(component.formatFileSize(1024 * 1024 * 1024 * 2)).toBe('2.0 GB');
		});
	});

	describe('previewData', () => {
		it('should return null when no pending file', () => {
			expect(component.previewData()).toBeNull();
		});
	});

	describe('existingMediaPreview', () => {
		it('should return null when no existing media', () => {
			expect(component.existingMediaPreview()).toBeNull();
		});

		it('should create preview data from existing media', () => {
			fixture.componentRef.setInput('existingMedia', {
				url: 'https://example.com/img.jpg',
				path: 'uploads/img.jpg',
				mimeType: 'image/jpeg',
				filename: 'img.jpg',
				alt: 'An image',
			});

			const preview = component.existingMediaPreview();
			expect(preview).toEqual({
				url: 'https://example.com/img.jpg',
				path: 'uploads/img.jpg',
				mimeType: 'image/jpeg',
				filename: 'img.jpg',
				alt: 'An image',
			});
		});

		it('should handle partial existing media', () => {
			fixture.componentRef.setInput('existingMedia', { filename: 'doc.pdf' });

			const preview = component.existingMediaPreview();
			expect(preview).toBeDefined();
			expect(preview?.filename).toBe('doc.pdf');
			expect(preview?.mimeType).toBeUndefined();
		});
	});

	describe('existingFilename', () => {
		it('should return "Uploaded file" when no existing media', () => {
			expect(component.existingFilename()).toBe('Uploaded file');
		});

		it('should return filename from existing media', () => {
			fixture.componentRef.setInput('existingMedia', { filename: 'report.pdf' });
			expect(component.existingFilename()).toBe('report.pdf');
		});
	});

	describe('existingMimeType', () => {
		it('should return empty string when no existing media', () => {
			expect(component.existingMimeType()).toBe('');
		});

		it('should return mimeType from existing media', () => {
			fixture.componentRef.setInput('existingMedia', { mimeType: 'application/pdf' });
			expect(component.existingMimeType()).toBe('application/pdf');
		});
	});

	describe('mimeTypesHint', () => {
		it('should return null when no upload config', () => {
			expect(component.mimeTypesHint()).toBeNull();
		});

		it('should return null when empty mimeTypes', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: [] });
			expect(component.mimeTypesHint()).toBeNull();
		});

		it('should simplify image/* to Images', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['image/*'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Images');
		});

		it('should simplify video/* to Videos', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['video/*'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Videos');
		});

		it('should simplify audio/* to Audio', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['audio/*'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Audio');
		});

		it('should simplify application/pdf to PDF', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['application/pdf'] });
			expect(component.mimeTypesHint()).toBe('Allowed: PDF');
		});

		it('should pass through unknown MIME types', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['text/csv'] });
			expect(component.mimeTypesHint()).toBe('Allowed: text/csv');
		});

		it('should combine multiple types', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['image/*', 'application/pdf'] });
			expect(component.mimeTypesHint()).toBe('Allowed: Images, PDF');
		});
	});

	describe('maxSizeHint', () => {
		it('should return null when no upload config', () => {
			expect(component.maxSizeHint()).toBeNull();
		});

		it('should return null when no maxFileSize', () => {
			fixture.componentRef.setInput('uploadConfig', {});
			expect(component.maxSizeHint()).toBeNull();
		});

		it('should format bytes', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 500 });
			expect(component.maxSizeHint()).toBe('500 bytes');
		});

		it('should format KB', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1024 * 5 });
			expect(component.maxSizeHint()).toBe('5.0 KB');
		});

		it('should format MB', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1024 * 1024 * 10 });
			expect(component.maxSizeHint()).toBe('10.0 MB');
		});

		it('should format GB', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1024 * 1024 * 1024 * 2 });
			expect(component.maxSizeHint()).toBe('2.0 GB');
		});
	});

	describe('acceptAttribute', () => {
		it('should return */* when no upload config', () => {
			expect(component.acceptAttribute()).toBe('*/*');
		});

		it('should return */* when empty mimeTypes', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: [] });
			expect(component.acceptAttribute()).toBe('*/*');
		});

		it('should join mime types', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['image/*', 'application/pdf'] });
			expect(component.acceptAttribute()).toBe('image/*,application/pdf');
		});
	});

	describe('drag events', () => {
		it('should set isDragging on dragOver', () => {
			const event = new Event('dragover', { cancelable: true, bubbles: true }) as DragEvent;
			component.onDragOver(event);
			expect(component.isDragging()).toBe(true);
		});

		it('should not set isDragging when disabled', () => {
			fixture.componentRef.setInput('disabled', true);
			const event = new Event('dragover', { cancelable: true, bubbles: true }) as DragEvent;
			component.onDragOver(event);
			expect(component.isDragging()).toBe(false);
		});

		it('should unset isDragging on dragLeave', () => {
			component.isDragging.set(true);
			const event = new Event('dragleave', { cancelable: true, bubbles: true }) as DragEvent;
			component.onDragLeave(event);
			expect(component.isDragging()).toBe(false);
		});

		it('should unset isDragging on drop', () => {
			component.isDragging.set(true);
			const event = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
			component.onDrop(event);
			expect(component.isDragging()).toBe(false);
		});

		it('should not emit fileSelected on drop when disabled', () => {
			fixture.componentRef.setInput('disabled', true);
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const event = new Event('drop', { cancelable: true, bubbles: true }) as DragEvent;
			component.onDrop(event);

			expect(emitted).toHaveLength(0);
		});
	});

	describe('triggerFileInput', () => {
		it('should not throw when disabled', () => {
			fixture.componentRef.setInput('disabled', true);
			expect(() => component.triggerFileInput()).not.toThrow();
		});
	});

	describe('onFileSelected', () => {
		it('should handle non-input target', () => {
			const event = new Event('change');
			expect(() => component.onFileSelected(event)).not.toThrow();
		});
	});

	describe('removeFile', () => {
		it('should emit fileRemoved', () => {
			let emitted = false;
			component.fileRemoved.subscribe(() => {
				emitted = true;
			});
			component.removeFile();
			expect(emitted).toBe(true);
		});
	});
});
