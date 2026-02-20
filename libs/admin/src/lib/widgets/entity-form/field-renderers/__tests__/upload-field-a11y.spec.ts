import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { Field } from '@momentumcms/core';
import { UploadFieldRenderer } from '../upload-field.component';
import { DialogService } from '@momentumcms/ui';

function createUploadField(overrides?: Partial<Field>): Field {
	return {
		name: 'coverImage',
		type: 'upload',
		label: 'Cover Image',
		relationTo: 'media',
		...overrides,
	} as Field;
}

describe('UploadFieldRenderer - keyboard accessibility', () => {
	let fixture: ComponentFixture<UploadFieldRenderer>;
	let component: UploadFieldRenderer;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [UploadFieldRenderer],
			providers: [provideHttpClient(), provideHttpClientTesting(), DialogService],
		}).compileComponents();
	});

	function createFixture(field?: Field, mode?: string): void {
		fixture = TestBed.createComponent(UploadFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('field', field ?? createUploadField());
		fixture.componentRef.setInput('path', 'coverImage');
		if (mode) {
			fixture.componentRef.setInput('mode', mode);
		}
	}

	function getDropZone(): HTMLElement | null {
		return fixture.nativeElement.querySelector('[role="button"]');
	}

	it('should have role="button" on drop zone', () => {
		createFixture();
		fixture.detectChanges();

		expect(getDropZone()).toBeTruthy();
	});

	it('should have tabindex="0" on drop zone', () => {
		createFixture();
		fixture.detectChanges();

		const dropZone = getDropZone();
		expect(dropZone).toBeTruthy();
		expect(dropZone!.getAttribute('tabindex')).toBe('0');
	});

	it('should have aria-label containing the field label', () => {
		createFixture();
		fixture.detectChanges();

		const dropZone = getDropZone();
		expect(dropZone).toBeTruthy();
		expect(dropZone!.getAttribute('aria-label')).toContain('Cover Image');
	});

	it('should trigger file input on Enter key', () => {
		createFixture();
		fixture.detectChanges();

		const dropZone = getDropZone();
		expect(dropZone).toBeTruthy();

		const triggerSpy = vi.spyOn(component, 'triggerFileInput');
		dropZone!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		fixture.detectChanges();

		expect(triggerSpy).toHaveBeenCalled();
	});

	it('should trigger file input on Space key', () => {
		createFixture();
		fixture.detectChanges();

		const dropZone = getDropZone();
		expect(dropZone).toBeTruthy();

		const triggerSpy = vi.spyOn(component, 'triggerFileInput');
		dropZone!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		fixture.detectChanges();

		expect(triggerSpy).toHaveBeenCalled();
	});

	it('should have aria-disabled="true" when field is disabled', () => {
		createFixture(createUploadField(), 'view');
		fixture.detectChanges();

		const dropZone = getDropZone();
		expect(dropZone).toBeTruthy();
		expect(dropZone!.getAttribute('aria-disabled')).toBe('true');
	});

	it('should have aria-disabled="false" when field is enabled', () => {
		createFixture(createUploadField(), 'create');
		fixture.detectChanges();

		const dropZone = getDropZone();
		expect(dropZone).toBeTruthy();
		expect(dropZone!.getAttribute('aria-disabled')).toBe('false');
	});

	it('should not open file picker on Enter when disabled', () => {
		createFixture(createUploadField(), 'view');
		fixture.detectChanges();

		const dropZone = getDropZone();
		expect(dropZone).toBeTruthy();

		const triggerSpy = vi.spyOn(component, 'triggerFileInput');
		dropZone!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		fixture.detectChanges();

		// triggerFileInput is called by the binding but early-returns when disabled
		expect(triggerSpy).toHaveBeenCalled();
		// Verify the hidden file input was NOT clicked (triggerFileInput guards on isDisabled)
		const fileInput = fixture.nativeElement.querySelector(
			'input[type="file"]',
		) as HTMLInputElement | null;
		if (fileInput) {
			const clickSpy = vi.spyOn(fileInput, 'click');
			dropZone!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
			expect(clickSpy).not.toHaveBeenCalled();
		}
	});
});
