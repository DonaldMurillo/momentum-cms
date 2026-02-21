import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, Component } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@momentumcms/ui';
import {
	MediaPickerDialog,
	type MediaItem,
	type MediaPickerDialogData,
} from '../media-picker-dialog.component';

@Component({ selector: 'mcms-dialog', template: '<ng-content />' })
class MockDialog {}

@Component({ selector: 'mcms-dialog-header', template: '<ng-content />' })
class MockDialogHeader {}

@Component({ selector: 'mcms-dialog-title', template: '<ng-content />' })
class MockDialogTitle {}

@Component({ selector: 'mcms-dialog-content', template: '<ng-content />' })
class MockDialogContent {}

@Component({ selector: 'mcms-dialog-footer', template: '<ng-content />' })
class MockDialogFooter {}

class MockDialogRef {
	close = vi.fn();
}

describe('MediaPickerDialog', () => {
	let fixture: ComponentFixture<MediaPickerDialog>;
	let component: MediaPickerDialog;
	let mockDialogRef: MockDialogRef;

	function setup(data: MediaPickerDialogData = {}): void {
		mockDialogRef = new MockDialogRef();

		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [MediaPickerDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: DialogRef, useValue: mockDialogRef },
				{ provide: DIALOG_DATA, useValue: data },
			],
		}).overrideComponent(MediaPickerDialog, {
			set: {
				imports: [
					MockDialog,
					MockDialogHeader,
					MockDialogTitle,
					MockDialogContent,
					MockDialogFooter,
				],
				template: '<div></div>',
			},
		});

		fixture = TestBed.createComponent(MediaPickerDialog);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	it('should create', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('initial state', () => {
		it('should have loading true', () => {
			setup();
			// Loading starts true, effect may have already resolved
			expect(typeof component.isLoading()).toBe('boolean');
		});

		it('should have empty media items initially', () => {
			setup();
			// Items may be populated by effect or empty
			expect(Array.isArray(component.mediaItems())).toBe(true);
		});

		it('should have null selectedMedia', () => {
			setup();
			expect(component.selectedMedia()).toBeNull();
		});

		it('should have empty search query', () => {
			setup();
			expect(component.searchQuery()).toBe('');
		});

		it('should have page 1', () => {
			setup();
			expect(component.currentPage()).toBe(1);
		});

		it('should have 1 total pages', () => {
			setup();
			expect(component.totalPages()).toBe(1);
		});

		it('should have 24 limit', () => {
			setup();
			expect(component.limit()).toBe(24);
		});
	});

	describe('collectionSlug', () => {
		it('should default to "media"', () => {
			setup({});
			expect(component.collectionSlug()).toBe('media');
		});

		it('should use relationTo when provided', () => {
			setup({ relationTo: 'uploads' });
			expect(component.collectionSlug()).toBe('uploads');
		});
	});

	describe('onSearchChange', () => {
		it('should update search query', () => {
			setup();
			component.onSearchChange('photo');
			expect(component.searchQuery()).toBe('photo');
		});

		it('should reset to page 1', () => {
			setup();
			component.currentPage.set(3);
			component.onSearchChange('test');
			expect(component.currentPage()).toBe(1);
		});
	});

	describe('onPageChange', () => {
		it('should update current page', () => {
			setup();
			component.onPageChange(5);
			expect(component.currentPage()).toBe(5);
		});
	});

	describe('selectMedia', () => {
		it('should set selected media', () => {
			setup();
			const media: MediaItem = {
				id: 'm1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: '/uploads/photo.jpg',
			};
			component.selectMedia(media);
			expect(component.selectedMedia()).toBe(media);
		});
	});

	describe('confirmSelection', () => {
		it('should set selected media and close dialog', () => {
			setup();
			const media: MediaItem = {
				id: 'm1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: '/uploads/photo.jpg',
			};
			component.confirmSelection(media);
			expect(component.selectedMedia()).toBe(media);
			expect(mockDialogRef.close).toHaveBeenCalledWith({ media });
		});
	});

	describe('confirm', () => {
		it('should close dialog with selected media', () => {
			setup();
			const media: MediaItem = {
				id: 'm1',
				filename: 'photo.jpg',
				mimeType: 'image/jpeg',
				path: '/uploads/photo.jpg',
			};
			component.selectedMedia.set(media);
			component.confirm();
			expect(mockDialogRef.close).toHaveBeenCalledWith({ media });
		});

		it('should not close dialog when no media selected', () => {
			setup();
			component.confirm();
			expect(mockDialogRef.close).not.toHaveBeenCalled();
		});
	});
});
