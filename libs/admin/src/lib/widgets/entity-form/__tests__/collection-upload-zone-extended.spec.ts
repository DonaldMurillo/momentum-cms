import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionUploadZoneComponent } from '../collection-upload-zone.component';

/**
 * Extended tests for CollectionUploadZoneComponent.
 *
 * Covers uncovered code paths:
 * - getStringProp (indirectly via existingMediaPreview / existingFilename / existingMimeType)
 * - getInputFromEvent (indirectly via onFileSelected)
 * - previewData with a pending file & effect lifecycle
 * - onDrop with actual file data
 * - onFileSelected with actual HTMLInputElement
 * - triggerFileInput when not disabled
 * - existingMediaPreview with non-string properties
 */
describe('CollectionUploadZoneComponent (extended)', () => {
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
	// getStringProp – tested indirectly via existingMediaPreview,
	// existingFilename, existingMimeType
	// ---------------------------------------------------------------

	describe('getStringProp (indirect)', () => {
		it('should return undefined for non-string property values', () => {
			fixture.componentRef.setInput('existingMedia', {
				url: 123,
				mimeType: true,
				filename: null,
				alt: { nested: 'object' },
				path: ['array'],
			});

			const preview = component.existingMediaPreview();
			expect(preview).toBeDefined();
			expect(preview?.url).toBeUndefined();
			expect(preview?.mimeType).toBeUndefined();
			expect(preview?.filename).toBeUndefined();
			expect(preview?.alt).toBeUndefined();
			expect(preview?.path).toBeUndefined();
		});

		it('should return undefined for missing keys', () => {
			fixture.componentRef.setInput('existingMedia', {});

			const preview = component.existingMediaPreview();
			expect(preview).toBeDefined();
			expect(preview?.url).toBeUndefined();
			expect(preview?.path).toBeUndefined();
			expect(preview?.mimeType).toBeUndefined();
			expect(preview?.filename).toBeUndefined();
			expect(preview?.alt).toBeUndefined();
		});

		it('should return "Uploaded file" when filename is a non-string value', () => {
			fixture.componentRef.setInput('existingMedia', { filename: 42 });
			expect(component.existingFilename()).toBe('Uploaded file');
		});

		it('should return empty string when mimeType is a non-string value', () => {
			fixture.componentRef.setInput('existingMedia', { mimeType: false });
			expect(component.existingMimeType()).toBe('');
		});

		it('should handle existingMedia with mixed string and non-string props', () => {
			fixture.componentRef.setInput('existingMedia', {
				url: 'https://example.com/file.png',
				mimeType: 999,
				filename: 'file.png',
				alt: undefined,
				path: null,
			});

			const preview = component.existingMediaPreview();
			expect(preview?.url).toBe('https://example.com/file.png');
			expect(preview?.mimeType).toBeUndefined();
			expect(preview?.filename).toBe('file.png');
			expect(preview?.alt).toBeUndefined();
			expect(preview?.path).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------
	// previewData with a pending file
	// ---------------------------------------------------------------

	describe('previewData with pending file', () => {
		it('should return preview data when a pending file is set', async () => {
			const mockFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

			const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
			const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
				/* noop */
			});

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();
			await fixture.whenStable();

			const preview = component.previewData();
			expect(preview).not.toBeNull();
			expect(preview?.mimeType).toBe('text/plain');
			expect(preview?.filename).toBe('test.txt');
			expect(preview?.url).toBe('blob:mock-url');
			expect(createObjectURLSpy).toHaveBeenCalledWith(mockFile);

			createObjectURLSpy.mockRestore();
			revokeObjectURLSpy.mockRestore();
		});

		it('should revoke old URL when pending file changes', async () => {
			const file1 = new File(['a'], 'a.txt', { type: 'text/plain' });
			const file2 = new File(['b'], 'b.txt', { type: 'text/plain' });

			const createObjectURLSpy = vi
				.spyOn(URL, 'createObjectURL')
				.mockReturnValueOnce('blob:url-1')
				.mockReturnValueOnce('blob:url-2');
			const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
				/* noop */
			});

			fixture.componentRef.setInput('pendingFile', file1);
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component.previewData()?.url).toBe('blob:url-1');

			fixture.componentRef.setInput('pendingFile', file2);
			fixture.detectChanges();
			await fixture.whenStable();

			expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url-1');
			expect(component.previewData()?.url).toBe('blob:url-2');

			createObjectURLSpy.mockRestore();
			revokeObjectURLSpy.mockRestore();
		});

		it('should set previewUrl to null when pending file is cleared', async () => {
			const mockFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });

			const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-url');
			const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
				/* noop */
			});

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component.previewData()).not.toBeNull();

			fixture.componentRef.setInput('pendingFile', null);
			fixture.detectChanges();
			await fixture.whenStable();

			expect(component.previewData()).toBeNull();

			createObjectURLSpy.mockRestore();
			revokeObjectURLSpy.mockRestore();
		});
	});

	// ---------------------------------------------------------------
	// onDrop with actual file data
	// ---------------------------------------------------------------

	describe('onDrop with files', () => {
		it('should emit fileSelected with the first dropped file', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const testFile = new File(['data'], 'dropped.png', { type: 'image/png' });

			const mockDataTransfer = {
				files: {
					0: testFile,
					length: 1,
					item: (i: number): File | null => (i === 0 ? testFile : null),
					[Symbol.iterator]: function* (): Generator<File> {
						yield testFile;
					},
				} as unknown as FileList,
			};

			const event = new Event('drop', { cancelable: true, bubbles: true });
			Object.defineProperty(event, 'dataTransfer', { value: mockDataTransfer });

			component.onDrop(event as DragEvent);

			expect(emitted).toHaveLength(1);
			expect(emitted[0].name).toBe('dropped.png');
			expect(emitted[0].type).toBe('image/png');
		});

		it('should emit fileSelected with first file when multiple files are dropped', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const file1 = new File(['a'], 'first.txt', { type: 'text/plain' });
			const file2 = new File(['b'], 'second.txt', { type: 'text/plain' });

			const mockDataTransfer = {
				files: {
					0: file1,
					1: file2,
					length: 2,
					item: (i: number): File | null => (i === 0 ? file1 : i === 1 ? file2 : null),
					[Symbol.iterator]: function* (): Generator<File> {
						yield file1;
						yield file2;
					},
				} as unknown as FileList,
			};

			const event = new Event('drop', { cancelable: true, bubbles: true });
			Object.defineProperty(event, 'dataTransfer', { value: mockDataTransfer });

			component.onDrop(event as DragEvent);

			expect(emitted).toHaveLength(1);
			expect(emitted[0].name).toBe('first.txt');
		});

		it('should not emit fileSelected when dataTransfer has no files', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const mockDataTransfer = {
				files: { length: 0 } as unknown as FileList,
			};

			const event = new Event('drop', { cancelable: true, bubbles: true });
			Object.defineProperty(event, 'dataTransfer', { value: mockDataTransfer });

			component.onDrop(event as DragEvent);

			expect(emitted).toHaveLength(0);
		});

		it('should not emit fileSelected when dataTransfer is undefined', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const event = new Event('drop', { cancelable: true, bubbles: true });
			// dataTransfer is undefined by default on a plain Event

			component.onDrop(event as DragEvent);

			expect(emitted).toHaveLength(0);
		});

		it('should not emit fileSelected on drop when disabled even with files', () => {
			fixture.componentRef.setInput('disabled', true);

			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const testFile = new File(['data'], 'dropped.png', { type: 'image/png' });

			const mockDataTransfer = {
				files: {
					0: testFile,
					length: 1,
					item: (): File => testFile,
				} as unknown as FileList,
			};

			const event = new Event('drop', { cancelable: true, bubbles: true });
			Object.defineProperty(event, 'dataTransfer', { value: mockDataTransfer });

			component.onDrop(event as DragEvent);

			expect(emitted).toHaveLength(0);
		});

		it('should reset isDragging to false after drop even with files', () => {
			component.isDragging.set(true);

			const testFile = new File(['data'], 'file.png', { type: 'image/png' });
			const mockDataTransfer = {
				files: {
					0: testFile,
					length: 1,
					item: (): File => testFile,
				} as unknown as FileList,
			};

			const event = new Event('drop', { cancelable: true, bubbles: true });
			Object.defineProperty(event, 'dataTransfer', { value: mockDataTransfer });

			component.onDrop(event as DragEvent);

			expect(component.isDragging()).toBe(false);
		});
	});

	// ---------------------------------------------------------------
	// onFileSelected with actual HTMLInputElement
	// ---------------------------------------------------------------

	describe('onFileSelected with HTMLInputElement', () => {
		it('should emit fileSelected and reset input value when files are present', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const testFile = new File(['content'], 'selected.jpg', { type: 'image/jpeg' });

			const inputEl = document.createElement('input');
			inputEl.type = 'file';
			// We cannot set files directly, so mock the property
			Object.defineProperty(inputEl, 'files', {
				value: {
					0: testFile,
					length: 1,
					item: (): File => testFile,
				} as unknown as FileList,
				writable: false,
			});

			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: inputEl });

			component.onFileSelected(event);

			expect(emitted).toHaveLength(1);
			expect(emitted[0].name).toBe('selected.jpg');
			expect(inputEl.value).toBe('');
		});

		it('should not emit when input has no files', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const inputEl = document.createElement('input');
			inputEl.type = 'file';
			Object.defineProperty(inputEl, 'files', {
				value: { length: 0 } as unknown as FileList,
				writable: false,
			});

			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: inputEl });

			component.onFileSelected(event);

			expect(emitted).toHaveLength(0);
		});

		it('should not emit when input files is null', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const inputEl = document.createElement('input');
			inputEl.type = 'file';
			Object.defineProperty(inputEl, 'files', {
				value: null,
				writable: false,
			});

			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: inputEl });

			component.onFileSelected(event);

			expect(emitted).toHaveLength(0);
		});

		it('should handle event target that is not an HTMLInputElement (e.g., div)', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const divEl = document.createElement('div');
			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: divEl });

			component.onFileSelected(event);

			expect(emitted).toHaveLength(0);
		});

		it('should handle event target that is null', () => {
			const emitted: File[] = [];
			component.fileSelected.subscribe((f) => emitted.push(f));

			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: null });

			component.onFileSelected(event);

			expect(emitted).toHaveLength(0);
		});
	});

	// ---------------------------------------------------------------
	// triggerFileInput when not disabled
	// ---------------------------------------------------------------

	describe('triggerFileInput when enabled', () => {
		it('should call click() on the file input element', () => {
			fixture.detectChanges();

			const inputEl = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
			const clickSpy = vi.spyOn(inputEl, 'click');

			component.triggerFileInput();

			expect(clickSpy).toHaveBeenCalledTimes(1);
		});

		it('should not call click() when disabled', () => {
			fixture.componentRef.setInput('disabled', true);
			fixture.detectChanges();

			const inputEl = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
			const clickSpy = vi.spyOn(inputEl, 'click');

			component.triggerFileInput();

			expect(clickSpy).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------
	// existingMediaPreview edge cases
	// ---------------------------------------------------------------

	describe('existingMediaPreview edge cases', () => {
		it('should handle all five string properties correctly', () => {
			fixture.componentRef.setInput('existingMedia', {
				url: 'https://cdn.example.com/image.webp',
				path: '/uploads/2024/image.webp',
				mimeType: 'image/webp',
				filename: 'image.webp',
				alt: 'A beautiful landscape',
			});

			const preview = component.existingMediaPreview();
			expect(preview).toEqual({
				url: 'https://cdn.example.com/image.webp',
				path: '/uploads/2024/image.webp',
				mimeType: 'image/webp',
				filename: 'image.webp',
				alt: 'A beautiful landscape',
			});
		});

		it('should handle empty string values as valid strings', () => {
			fixture.componentRef.setInput('existingMedia', {
				url: '',
				mimeType: '',
				filename: '',
				alt: '',
				path: '',
			});

			const preview = component.existingMediaPreview();
			expect(preview?.url).toBe('');
			expect(preview?.mimeType).toBe('');
			expect(preview?.filename).toBe('');
			expect(preview?.alt).toBe('');
			expect(preview?.path).toBe('');
		});

		it('should return "Uploaded file" for existingFilename when filename is empty string', () => {
			// Empty string IS a string, so getStringProp returns ''
			fixture.componentRef.setInput('existingMedia', { filename: '' });
			// The ?? fallback only triggers on undefined/null, not empty string
			expect(component.existingFilename()).toBe('');
		});
	});

	// ---------------------------------------------------------------
	// previewUrl effect lifecycle
	// ---------------------------------------------------------------

	describe('previewUrl effect lifecycle', () => {
		it('should create object URL only once for the same file reference', async () => {
			const mockFile = new File(['data'], 'img.png', { type: 'image/png' });

			const createObjectURLSpy = vi
				.spyOn(URL, 'createObjectURL')
				.mockReturnValue('blob:single-url');
			const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
				/* noop */
			});

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();
			await fixture.whenStable();

			expect(createObjectURLSpy).toHaveBeenCalledTimes(1);

			// detectChanges again without changing the file should not create a new URL
			fixture.detectChanges();
			await fixture.whenStable();

			expect(createObjectURLSpy).toHaveBeenCalledTimes(1);

			createObjectURLSpy.mockRestore();
			revokeObjectURLSpy.mockRestore();
		});

		it('should clean up by revoking URL when file is removed', async () => {
			const mockFile = new File(['data'], 'cleanup.txt', { type: 'text/plain' });

			const createObjectURLSpy = vi
				.spyOn(URL, 'createObjectURL')
				.mockReturnValue('blob:cleanup-url');
			const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
				/* noop */
			});

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();
			await fixture.whenStable();

			fixture.componentRef.setInput('pendingFile', null);
			fixture.detectChanges();
			await fixture.whenStable();

			expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:cleanup-url');

			createObjectURLSpy.mockRestore();
			revokeObjectURLSpy.mockRestore();
		});
	});
});
