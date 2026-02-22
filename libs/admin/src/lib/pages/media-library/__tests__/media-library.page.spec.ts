/**
 * Tests for MediaLibraryPage.
 *
 * The component uses effect() in constructor to call loadMedia on init,
 * which depends on injectMomentumAPI(). We test the utility functions
 * and public methods that don't require the full injection context.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MediaLibraryPage } from '../media-library.page';

describe('MediaLibraryPage', () => {
	let component: MediaLibraryPage;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MediaLibraryPage],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		})
			.overrideComponent(MediaLibraryPage, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();

		const fixture = TestBed.createComponent(MediaLibraryPage);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('initial state', () => {
		it('should have loading true', () => {
			expect(component.isLoading()).toBe(true);
		});

		it('should have empty media items', () => {
			expect(component.mediaItems()).toEqual([]);
		});

		it('should have empty search query', () => {
			expect(component.searchQuery()).toBe('');
		});

		it('should have page 1', () => {
			expect(component.currentPage()).toBe(1);
		});

		it('should have 1 total pages', () => {
			expect(component.totalPages()).toBe(1);
		});

		it('should have 0 total docs', () => {
			expect(component.totalDocs()).toBe(0);
		});

		it('should have 24 limit', () => {
			expect(component.limit()).toBe(24);
		});

		it('should have empty selected items', () => {
			expect(component.selectedItems().size).toBe(0);
		});

		it('should have empty active uploads', () => {
			expect(component.activeUploads()).toEqual([]);
		});
	});

	describe('onSearchChange', () => {
		it('should update search query', () => {
			component.onSearchChange('photo');
			expect(component.searchQuery()).toBe('photo');
		});

		it('should reset to page 1', () => {
			component.currentPage.set(5);
			component.onSearchChange('test');
			expect(component.currentPage()).toBe(1);
		});
	});

	describe('onPageChange', () => {
		it('should update current page', () => {
			component.onPageChange(3);
			expect(component.currentPage()).toBe(3);
		});
	});

	describe('toggleSelection', () => {
		const media = {
			id: 'm1',
			filename: 'photo.jpg',
			mimeType: 'image/jpeg',
			path: '/uploads/photo.jpg',
		};

		it('should add item to selection', () => {
			component.toggleSelection(media);
			expect(component.selectedItems().has('m1')).toBe(true);
		});

		it('should remove item from selection if already selected', () => {
			component.toggleSelection(media);
			expect(component.selectedItems().has('m1')).toBe(true);
			component.toggleSelection(media);
			expect(component.selectedItems().has('m1')).toBe(false);
		});

		it('should handle multiple selections', () => {
			const media2 = {
				id: 'm2',
				filename: 'video.mp4',
				mimeType: 'video/mp4',
				path: '/uploads/video.mp4',
			};
			component.toggleSelection(media);
			component.toggleSelection(media2);
			expect(component.selectedItems().size).toBe(2);
		});
	});

	describe('getMediaUrl', () => {
		it('should return url when provided', () => {
			const media = {
				id: '1',
				filename: 'a.jpg',
				mimeType: 'image/jpeg',
				path: 'uploads/a.jpg',
				url: 'https://cdn.example.com/a.jpg',
			};
			expect(component.getMediaUrl(media)).toBe('https://cdn.example.com/a.jpg');
		});

		it('should fallback to /api/media/file/ path', () => {
			const media = { id: '1', filename: 'a.jpg', mimeType: 'image/jpeg', path: 'uploads/a.jpg' };
			expect(component.getMediaUrl(media)).toBe('/api/media/file/uploads/a.jpg');
		});
	});

	describe('formatFileSize', () => {
		it('should return "Unknown size" for undefined', () => {
			expect(component.formatFileSize(undefined)).toBe('Unknown size');
		});

		it('should return "Unknown size" for 0', () => {
			expect(component.formatFileSize(0)).toBe('Unknown size');
		});

		it('should format bytes', () => {
			expect(component.formatFileSize(512)).toBe('512 bytes');
		});

		it('should format KB', () => {
			expect(component.formatFileSize(1024 * 5)).toBe('5.0 KB');
		});

		it('should format MB', () => {
			expect(component.formatFileSize(1024 * 1024 * 2)).toBe('2.0 MB');
		});

		it('should format GB', () => {
			expect(component.formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
		});
	});

	describe('onFilesSelected', () => {
		it('should handle null input target', () => {
			const event = new Event('change');
			expect(() => component.onFilesSelected(event)).not.toThrow();
		});

		it('should handle empty files list', () => {
			const input = document.createElement('input');
			input.type = 'file';
			const event = new Event('change', { bubbles: true });
			Object.defineProperty(event, 'target', { value: input });
			expect(() => component.onFilesSelected(event)).not.toThrow();
		});
	});

	describe('viewMedia', () => {
		it('should not throw', () => {
			const media = { id: '1', filename: 'a.jpg', mimeType: 'image/jpeg', path: 'uploads/a.jpg' };
			expect(() => component.viewMedia(media)).not.toThrow();
		});
	});
});
