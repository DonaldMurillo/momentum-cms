/**
 * Template coverage tests for CollectionUploadZoneComponent.
 *
 * Renders the REAL component template so that all template expression
 * statements (bindings, `@if`, `@for`, event handlers, attribute bindings)
 * are evaluated by the coverage tool.
 *
 * Strategy:
 *   - Use NO_ERRORS_SCHEMA so unknown child selectors are tolerated.
 *   - Override only the component's `imports` (to []) — keep the template.
 *   - Manipulate inputs to hit each `@if`/`@else if`/`@else` branch.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CollectionUploadZoneComponent } from '../collection-upload-zone.component';

describe('CollectionUploadZoneComponent (template coverage)', () => {
	let fixture: ComponentFixture<CollectionUploadZoneComponent>;
	let component: CollectionUploadZoneComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [CollectionUploadZoneComponent],
			schemas: [NO_ERRORS_SCHEMA],
		})
			.overrideComponent(CollectionUploadZoneComponent, {
				set: { imports: [], schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA] },
			})
			.compileComponents();
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	function createComponent(): void {
		fixture = TestBed.createComponent(CollectionUploadZoneComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	// -------------------------------------------------------------------
	// Branch 1: @if (pendingFile()) — file selected preview
	// -------------------------------------------------------------------
	describe('pending file preview branch', () => {
		it('should render pending file info when pendingFile is set', () => {
			createComponent();
			const mockFile = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
			Object.defineProperty(mockFile, 'size', { value: 1024 * 500 });

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();

			const nameEl = fixture.nativeElement.querySelector('.truncate');
			expect(nameEl).toBeTruthy();
			expect(nameEl.textContent).toContain('photo.jpg');
		});

		it('should display file size and type', () => {
			createComponent();
			const mockFile = new File(['x'.repeat(2048)], 'doc.pdf', { type: 'application/pdf' });

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('application/pdf');
		});

		it('should render progress bar when isUploading is true', () => {
			createComponent();
			const mockFile = new File(['data'], 'upload.png', { type: 'image/png' });

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.componentRef.setInput('isUploading', true);
			fixture.componentRef.setInput('uploadProgress', 45);
			fixture.detectChanges();

			const progressText = fixture.nativeElement.textContent;
			expect(progressText).toContain('45% uploaded');
		});

		it('should render remove button when NOT uploading', () => {
			createComponent();
			const mockFile = new File(['data'], 'remove-me.jpg', { type: 'image/jpeg' });

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.componentRef.setInput('isUploading', false);
			fixture.detectChanges();

			const removeBtn = fixture.nativeElement.querySelector('[aria-label="Remove selected file"]');
			expect(removeBtn).toBeTruthy();
		});

		it('should NOT render remove button when uploading', () => {
			createComponent();
			const mockFile = new File(['data'], 'uploading.jpg', { type: 'image/jpeg' });

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.componentRef.setInput('isUploading', true);
			fixture.detectChanges();

			const removeBtn = fixture.nativeElement.querySelector('[aria-label="Remove selected file"]');
			expect(removeBtn).toBeNull();
		});

		it('should call removeFile when remove button is clicked', () => {
			createComponent();
			const mockFile = new File(['data'], 'to-remove.jpg', { type: 'image/jpeg' });

			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'removeFile');
			const removeBtn = fixture.nativeElement.querySelector('[aria-label="Remove selected file"]');
			removeBtn.click();
			expect(spy).toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------
	// Branch 2: @else if (existingMediaPreview()) — edit mode existing file
	// -------------------------------------------------------------------
	describe('existing media preview branch', () => {
		it('should render existing file info when existingMedia is set', () => {
			createComponent();
			fixture.componentRef.setInput('existingMedia', {
				url: 'https://example.com/img.jpg',
				filename: 'img.jpg',
				mimeType: 'image/jpeg',
				path: '/uploads/img.jpg',
			});
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('img.jpg');
			expect(text).toContain('image/jpeg');
		});

		it('should render Replace button when not disabled', () => {
			createComponent();
			fixture.componentRef.setInput('existingMedia', {
				filename: 'old.png',
				mimeType: 'image/png',
			});
			fixture.componentRef.setInput('disabled', false);
			fixture.detectChanges();

			const replaceBtn = fixture.nativeElement.querySelector('[aria-label="Replace file"]');
			expect(replaceBtn).toBeTruthy();
		});

		it('should NOT render Replace button when disabled', () => {
			createComponent();
			fixture.componentRef.setInput('existingMedia', {
				filename: 'locked.png',
				mimeType: 'image/png',
			});
			fixture.componentRef.setInput('disabled', true);
			fixture.detectChanges();

			const replaceBtn = fixture.nativeElement.querySelector('[aria-label="Replace file"]');
			expect(replaceBtn).toBeNull();
		});

		it('should call triggerFileInput when Replace button is clicked', () => {
			createComponent();
			fixture.componentRef.setInput('existingMedia', {
				filename: 'replace-me.jpg',
				mimeType: 'image/jpeg',
			});
			fixture.detectChanges();

			const spy = vi.spyOn(component, 'triggerFileInput');
			const replaceBtn = fixture.nativeElement.querySelector('[aria-label="Replace file"]');
			replaceBtn.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should render file input with accept attribute', () => {
			createComponent();
			fixture.componentRef.setInput('existingMedia', {
				filename: 'doc.pdf',
				mimeType: 'application/pdf',
			});
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['application/pdf'] });
			fixture.detectChanges();

			const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
			expect(fileInput).toBeTruthy();
			expect(fileInput.getAttribute('accept')).toBe('application/pdf');
		});
	});

	// -------------------------------------------------------------------
	// Branch 3: @else — drop zone (default)
	// -------------------------------------------------------------------
	describe('drop zone branch (default)', () => {
		it('should render drop zone when no pending file or existing media', () => {
			createComponent();

			const dropZone = fixture.nativeElement.querySelector('[role="button"]');
			expect(dropZone).toBeTruthy();
			expect(dropZone.textContent).toContain('Drag & drop or click to upload');
		});

		it('should display "Drop file here" text when dragging', () => {
			createComponent();
			component.isDragging.set(true);
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Drop file here');
		});

		it('should apply dragging-specific CSS classes when isDragging is true', () => {
			createComponent();
			const dropZone = fixture.nativeElement.querySelector('[role="button"]');

			expect(dropZone.classList.contains('border-mcms-primary')).toBe(false);

			component.isDragging.set(true);
			fixture.detectChanges();

			expect(dropZone.classList.contains('border-mcms-primary')).toBe(true);
		});

		it('should bind disabled state classes', () => {
			createComponent();
			fixture.componentRef.setInput('disabled', true);
			fixture.detectChanges();

			const dropZone = fixture.nativeElement.querySelector('[role="button"]');
			expect(dropZone.classList.contains('opacity-50')).toBe(true);
			expect(dropZone.getAttribute('aria-disabled')).toBe('true');
		});

		it('should show mimeTypesHint when upload config has mimeTypes', () => {
			createComponent();
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['image/*', 'application/pdf'] });
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Allowed: Images, PDF');
		});

		it('should NOT show mimeTypesHint when no mimeTypes configured', () => {
			createComponent();
			const text = fixture.nativeElement.textContent;
			expect(text).not.toContain('Allowed:');
		});

		it('should show maxSizeHint when upload config has maxFileSize', () => {
			createComponent();
			fixture.componentRef.setInput('uploadConfig', { maxFileSize: 1024 * 1024 * 10 });
			fixture.detectChanges();

			const text = fixture.nativeElement.textContent;
			expect(text).toContain('Max size: 10.0 MB');
		});

		it('should NOT show maxSizeHint when no maxFileSize configured', () => {
			createComponent();
			const text = fixture.nativeElement.textContent;
			expect(text).not.toContain('Max size:');
		});

		it('should call onDragOver when dragover event fires', () => {
			createComponent();
			const spy = vi.spyOn(component, 'onDragOver');
			const dropZone = fixture.nativeElement.querySelector('[role="button"]');

			const event = new Event('dragover', { cancelable: true, bubbles: true });
			dropZone.dispatchEvent(event);
			expect(spy).toHaveBeenCalled();
		});

		it('should call onDragLeave when dragleave event fires', () => {
			createComponent();
			const spy = vi.spyOn(component, 'onDragLeave');
			const dropZone = fixture.nativeElement.querySelector('[role="button"]');

			const event = new Event('dragleave', { cancelable: true, bubbles: true });
			dropZone.dispatchEvent(event);
			expect(spy).toHaveBeenCalled();
		});

		it('should call onDrop when drop event fires', () => {
			createComponent();
			const spy = vi.spyOn(component, 'onDrop');
			const dropZone = fixture.nativeElement.querySelector('[role="button"]');

			const event = new Event('drop', { cancelable: true, bubbles: true });
			dropZone.dispatchEvent(event);
			expect(spy).toHaveBeenCalled();
		});

		it('should call triggerFileInput on click', () => {
			createComponent();
			const spy = vi.spyOn(component, 'triggerFileInput');
			const dropZone = fixture.nativeElement.querySelector('[role="button"]');

			dropZone.click();
			expect(spy).toHaveBeenCalled();
		});

		it('should call triggerFileInput on Enter keydown', () => {
			createComponent();
			const spy = vi.spyOn(component, 'triggerFileInput');
			const dropZone = fixture.nativeElement.querySelector('[role="button"]');

			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
			dropZone.dispatchEvent(event);
			expect(spy).toHaveBeenCalled();
		});

		it('should call triggerFileInput on Space keydown', () => {
			createComponent();
			const spy = vi.spyOn(component, 'triggerFileInput');
			const dropZone = fixture.nativeElement.querySelector('[role="button"]');

			const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
			dropZone.dispatchEvent(event);
			expect(spy).toHaveBeenCalled();
		});

		it('should render file input with accept and disabled bindings', () => {
			createComponent();
			fixture.componentRef.setInput('uploadConfig', { mimeTypes: ['image/*'] });
			fixture.componentRef.setInput('disabled', true);
			fixture.detectChanges();

			const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
			expect(fileInput).toBeTruthy();
			expect(fileInput.getAttribute('accept')).toBe('image/*');
			expect(fileInput.disabled).toBe(true);
		});

		it('should handle file selection from the hidden input', () => {
			createComponent();
			const spy = vi.spyOn(component, 'onFileSelected');
			const fileInput = fixture.nativeElement.querySelector('input[type="file"]');

			const changeEvent = new Event('change', { bubbles: true });
			fileInput.dispatchEvent(changeEvent);
			expect(spy).toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------
	// Error message branch: @if (error())
	// -------------------------------------------------------------------
	describe('error message display', () => {
		it('should render error message when error is set', () => {
			createComponent();
			fixture.componentRef.setInput('error', 'File too large');
			fixture.detectChanges();

			const errorEl = fixture.nativeElement.querySelector('.text-mcms-destructive');
			expect(errorEl).toBeTruthy();
			expect(errorEl.textContent).toContain('File too large');
		});

		it('should NOT render error message when error is null', () => {
			createComponent();
			fixture.componentRef.setInput('error', null);
			fixture.detectChanges();

			const errorEl = fixture.nativeElement.querySelector('.text-mcms-destructive');
			expect(errorEl).toBeNull();
		});
	});

	// -------------------------------------------------------------------
	// Branch transitions
	// -------------------------------------------------------------------
	describe('branch transitions', () => {
		it('should transition from drop zone to pending file', () => {
			createComponent();

			// Initially drop zone
			expect(fixture.nativeElement.querySelector('[role="button"]')).toBeTruthy();

			// Set pending file -> pending preview
			const mockFile = new File(['data'], 'new.jpg', { type: 'image/jpeg' });
			fixture.componentRef.setInput('pendingFile', mockFile);
			fixture.detectChanges();

			expect(fixture.nativeElement.querySelector('[role="button"]')).toBeNull();
			expect(fixture.nativeElement.textContent).toContain('new.jpg');
		});

		it('should transition from existing media to drop zone when media removed', () => {
			createComponent();
			fixture.componentRef.setInput('existingMedia', {
				filename: 'existing.jpg',
				mimeType: 'image/jpeg',
			});
			fixture.detectChanges();
			expect(fixture.nativeElement.textContent).toContain('existing.jpg');

			fixture.componentRef.setInput('existingMedia', null);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('[role="button"]')).toBeTruthy();
		});
	});
});
