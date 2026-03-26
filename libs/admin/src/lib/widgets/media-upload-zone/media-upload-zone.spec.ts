import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MediaUploadZoneComponent } from './media-upload-zone.component';
import type { FolderNode } from '../media-folder-tree/media-folder-tree.component';
import type { MediaTag } from '../media-tag-filter/media-tag-filter.component';
@Component({
	selector: 'mcms-test-host',
	imports: [MediaUploadZoneComponent],
	template: `
		<mcms-media-upload-zone
			[folders]="folders()"
			[tags]="tags()"
			(uploadComplete)="completeCount.set(completeCount() + 1)"
		/>
	`,
})
class TestHost {
	readonly folders = signal<FolderNode[]>([
		{ id: 'f1', name: 'Photos', parent: null },
		{ id: 'f2', name: 'Docs', parent: null },
	]);
	readonly tags = signal<MediaTag[]>([
		{ id: 't1', name: 'Nature', color: '#22c55e' },
		{ id: 't2', name: 'Portrait' },
	]);
	readonly completeCount = signal(0);
}

describe('MediaUploadZoneComponent', () => {
	let fixture: ComponentFixture<TestHost>;
	let component: MediaUploadZoneComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
			providers: [provideHttpClient(), provideHttpClientTesting()],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHost);
		component = fixture.debugElement.children[0].componentInstance as MediaUploadZoneComponent;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should render drop zone', () => {
		const dropZone = fixture.nativeElement.querySelector('[data-slot="drop-zone"]');
		expect(dropZone).toBeTruthy();
	});

	it('should render folder dropdown with options', () => {
		const select = fixture.nativeElement.querySelector(
			'[data-slot="folder-select"]',
		) as HTMLSelectElement;
		expect(select).toBeTruthy();
		expect(select.options.length).toBe(3); // None + 2 folders
	});

	it('should render tag buttons', () => {
		const tagBtns = fixture.nativeElement.querySelectorAll('[data-tag-id]');
		expect(tagBtns.length).toBe(2);
	});

	it('should toggle tag selection', () => {
		const tagBtns = fixture.nativeElement.querySelectorAll('[data-tag-id]');
		tagBtns[0].click();
		fixture.detectChanges();
		expect(component.selectedTagIds().has('t1')).toBe(true);

		tagBtns[0].click();
		fixture.detectChanges();
		expect(component.selectedTagIds().has('t1')).toBe(false);
	});

	it('should update folder selection', () => {
		const select = fixture.nativeElement.querySelector(
			'[data-slot="folder-select"]',
		) as HTMLSelectElement;
		select.value = 'f1';
		select.dispatchEvent(new Event('change'));
		fixture.detectChanges();
		expect(component.selectedFolderId()).toBe('f1');
	});

	it('should set isDragOver on dragover', () => {
		component.onDragOver(new Event('dragover') as DragEvent);
		expect(component.isDragOver()).toBe(true);
	});

	it('should clear isDragOver on dragleave', () => {
		component.isDragOver.set(true);
		component.onDragLeave(new Event('dragleave') as DragEvent);
		expect(component.isDragOver()).toBe(false);
	});

	it('should have role="region" on drop zone', () => {
		const dropZone = fixture.nativeElement.querySelector('[data-slot="drop-zone"]');
		expect(dropZone.getAttribute('role')).toBe('region');
	});

	it('should have aria-label on file input', () => {
		const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
		expect(fileInput.getAttribute('aria-label')).toBe('Upload files');
	});

	it('should not show upload queue when empty', () => {
		expect(fixture.nativeElement.querySelector('[data-slot="upload-queue"]')).toBeNull();
	});
});
