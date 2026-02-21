/**
 * Additional coverage tests for CollectionUploadZoneComponent.
 *
 * Targets remaining uncovered statements/branches not reached by the
 * base and extended spec files. Focuses on:
 * - onDragOver: preventDefault and stopPropagation calls
 * - onDragLeave: preventDefault and stopPropagation calls
 * - onDrop: preventDefault and stopPropagation calls
 * - mimeTypesHint: no mimeTypes property at all
 * - maxSizeHint: boundary values
 * - formatFileSize: exact boundary values
 * - acceptAttribute: with undefined uploadConfig
 * - triggerFileInput: when fileInputRef is not yet available
 * - previewData: url computed from previewUrl signal
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionUploadZoneComponent } from '../collection-upload-zone.component';

describe('CollectionUploadZoneComponent (coverage)', () => {
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

	// ---------------------------------------------------------------
	// Drag event details: preventDefault / stopPropagation coverage
	// ---------------------------------------------------------------

	describe('onDragOver - event handling details', () => {
		it('should call preventDefault on the event', () => {
			const event = new Event('dragover', { cancelable: true, bubbles: true });
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
			const stopPropSpy = vi.spyOn(event, 'stopPropagation');

			component.onDragOver(event as DragEvent);

			expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
			expect(stopPropSpy).toHaveBeenCalledTimes(1);
		});

		it('should still call preventDefault when disabled (but not set isDragging)', () => {
			fixture.componentRef.setInput('disabled', true);
			const event = new Event('dragover', { cancelable: true, bubbles: true });
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

			component.onDragOver(event as DragEvent);

			expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
			expect(component.isDragging()).toBe(false);
		});
	});

	describe('onDragLeave - event handling details', () => {
		it('should call preventDefault and stopPropagation', () => {
			const event = new Event('dragleave', { cancelable: true, bubbles: true });
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
			const stopPropSpy = vi.spyOn(event, 'stopPropagation');

			component.onDragLeave(event as DragEvent);

			expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
			expect(stopPropSpy).toHaveBeenCalledTimes(1);
		});

		it('should set isDragging to false even if it was already false', () => {
			expect(component.isDragging()).toBe(false);
			const event = new Event('dragleave', { cancelable: true, bubbles: true });
			component.onDragLeave(event as DragEvent);
			expect(component.isDragging()).toBe(false);
		});
	});

	describe('onDrop - event handling details', () => {
		it('should call preventDefault and stopPropagation', () => {
			const event = new Event('drop', { cancelable: true, bubbles: true });
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
			const stopPropSpy = vi.spyOn(event, 'stopPropagation');

			component.onDrop(event as DragEvent);

			expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
			expect(stopPropSpy).toHaveBeenCalledTimes(1);
		});

		it('should still call preventDefault when disabled', () => {
			fixture.componentRef.setInput('disabled', true);
			const event = new Event('drop', { cancelable: true, bubbles: true });
			const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

			component.onDrop(event as DragEvent);

			expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
		});
	});

	// ---------------------------------------------------------------
	// mimeTypesHint edge cases
	// ---------------------------------------------------------------
	describe('mimeTypesHint - uploadConfig without mimeTypes property', () => {
		it('should return null when uploadConfig has no mimeTypes key', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1000 });
			expect(component.mimeTypesHint()).toBeNull();
		});

		it('should return null when uploadConfig mimeTypes is undefined', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: undefined });
			expect(component.mimeTypesHint()).toBeNull();
		});
	});

	// ---------------------------------------------------------------
	// maxSizeHint - exact boundary values
	// ---------------------------------------------------------------
	describe('maxSizeHint - boundary values', () => {
		it('should format exactly 1 KB (1024 bytes)', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1024 });
			expect(component.maxSizeHint()).toBe('1.0 KB');
		});

		it('should format exactly 1 MB', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1024 * 1024 });
			expect(component.maxSizeHint()).toBe('1.0 MB');
		});

		it('should format exactly 1 GB', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1024 * 1024 * 1024 });
			expect(component.maxSizeHint()).toBe('1.0 GB');
		});

		it('should format 1023 bytes (just under 1 KB)', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1023 });
			expect(component.maxSizeHint()).toBe('1023 bytes');
		});

		it('should format 1 byte', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1 });
			expect(component.maxSizeHint()).toBe('1 bytes');
		});

		it('should return null when maxFileSize is 0', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 0 });
			expect(component.maxSizeHint()).toBeNull();
		});
	});

	// ---------------------------------------------------------------
	// formatFileSize - boundary values
	// ---------------------------------------------------------------
	describe('formatFileSize - boundary values', () => {
		it('should format exactly 1024 bytes as 1.0 KB', () => {
			expect(component.formatFileSize(1024)).toBe('1.0 KB');
		});

		it('should format 1023 bytes as bytes', () => {
			expect(component.formatFileSize(1023)).toBe('1023 bytes');
		});

		it('should format 1 byte', () => {
			expect(component.formatFileSize(1)).toBe('1 bytes');
		});

		it('should format 0 bytes', () => {
			expect(component.formatFileSize(0)).toBe('0 bytes');
		});
	});

	// ---------------------------------------------------------------
	// acceptAttribute - no mimeTypes key
	// ---------------------------------------------------------------
	describe('acceptAttribute - uploadConfig without mimeTypes', () => {
		it('should return */* when uploadConfig has no mimeTypes key', () => {
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 5000 });
			expect(component.acceptAttribute()).toBe('*/*');
		});

		it('should return */* when uploadConfig is undefined', () => {
			fixture.componentRef.setInput('uploadConfig', undefined);
			expect(component.acceptAttribute()).toBe('*/*');
		});

		it('should return single mime type without commas', () => {
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['image/png'] });
			expect(component.acceptAttribute()).toBe('image/png');
		});
	});

	// ---------------------------------------------------------------
	// triggerFileInput - when fileInputRef is undefined (edge case)
	// ---------------------------------------------------------------
	describe('triggerFileInput - no fileInputRef', () => {
		it('should not throw when fileInputRef is not available', async () => {
			// Override with a template that has no #fileInput
			await TestBed.resetTestingModule()
				.configureTestingModule({
					imports: [CollectionUploadZoneComponent],
				})
				.overrideComponent(CollectionUploadZoneComponent, {
					set: { template: '<div></div>', imports: [] },
				})
				.compileComponents();

			const localFixture = TestBed.createComponent(CollectionUploadZoneComponent);
			const localComponent = localFixture.componentInstance;
			localFixture.detectChanges();

			expect(() => localComponent.triggerFileInput()).not.toThrow();
		});
	});

	// ---------------------------------------------------------------
	// existingMediaPreview with different property types
	// ---------------------------------------------------------------
	describe('existingMediaPreview - property type handling', () => {
		it('should handle existingMedia where all values are numbers (non-string)', () => {
			fixture.componentRef.setInput('existingMedia', {
				url: 100,
				path: 200,
				mimeType: 300,
				filename: 400,
				alt: 500,
			});

			const preview = component.existingMediaPreview();
			expect(preview).toBeDefined();
			expect(preview?.url).toBeUndefined();
			expect(preview?.path).toBeUndefined();
			expect(preview?.mimeType).toBeUndefined();
			expect(preview?.filename).toBeUndefined();
			expect(preview?.alt).toBeUndefined();
		});

		it('should handle existingMedia with boolean values', () => {
			fixture.componentRef.setInput('existingMedia', {
				url: true,
				mimeType: false,
			});

			const preview = component.existingMediaPreview();
			expect(preview?.url).toBeUndefined();
			expect(preview?.mimeType).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------
	// previewData computed - pending file URL resolution
	// ---------------------------------------------------------------
	describe('previewData - with file that has empty type', () => {
		it('should still provide preview data for a file with empty type', async () => {
			const mockFile = new File(['test'], 'unknown-type', { type: '' });

			const createObjectURLSpy = vi
				.spyOn(URL, 'createObjectURL')
				.mockReturnValue('blob:empty-type');
			const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
				/* noop */
			});

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();
			await fixture.whenStable();

			const preview = component.previewData();
			expect(preview).not.toBeNull();
			expect(preview?.mimeType).toBe('');
			expect(preview?.filename).toBe('unknown-type');
			expect(preview?.url).toBe('blob:empty-type');

			createObjectURLSpy.mockRestore();
			revokeObjectURLSpy.mockRestore();
		});
	});

	// ---------------------------------------------------------------
	// removeFile emits fileRemoved output
	// ---------------------------------------------------------------
	describe('removeFile - output emission', () => {
		it('should emit fileRemoved event when called', () => {
			const emitted: void[] = [];
			component.fileRemoved.subscribe(() => emitted.push(undefined));

			component.removeFile();

			expect(emitted).toHaveLength(1);
		});
	});
});
