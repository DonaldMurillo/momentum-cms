import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@momentumcms/ui';
import {
	MediaEditDialog,
	type MediaEditDialogData,
	type MediaEditItem,
} from '../media-edit-dialog.component';

const mockMedia: MediaEditItem = {
	id: 'media-1',
	filename: 'photo.jpg',
	mimeType: 'image/jpeg',
	path: '/uploads/photo.jpg',
	url: '/uploads/photo.jpg',
	filesize: 1024 * 500, // 500 KB
	alt: 'A nice photo',
	width: 1920,
	height: 1080,
};

class MockDialogRef {
	close = vi.fn();
}

describe('MediaEditDialog', () => {
	let component: MediaEditDialog;
	let httpMock: HttpTestingController;
	let mockDialogRef: MockDialogRef;

	const dialogData: MediaEditDialogData = {
		media: mockMedia,
	};

	beforeEach(async () => {
		mockDialogRef = new MockDialogRef();

		await TestBed.configureTestingModule({
			imports: [MediaEditDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: DIALOG_DATA, useValue: dialogData },
				{ provide: DialogRef, useValue: mockDialogRef },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(MediaEditDialog);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpMock.verify();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialize form fields from media data', () => {
		expect(component.filename()).toBe('photo.jpg');
		expect(component.altText()).toBe('A nice photo');
		expect(component.isSaving()).toBe(false);
		expect(component.saveError()).toBeNull();
	});

	it('should format file size correctly', () => {
		expect(component.formattedSize).toBe('500.0 KB');
	});

	it('should detect changes', () => {
		expect(component.hasChanges()).toBe(false);

		component.filename.set('renamed.jpg');
		expect(component.hasChanges()).toBe(true);
	});

	it('should detect alt text changes', () => {
		expect(component.hasChanges()).toBe(false);

		component.altText.set('Updated alt text');
		expect(component.hasChanges()).toBe(true);
	});

	it('should expose media reference', () => {
		expect(component.media).toBe(mockMedia);
	});

	describe('save', () => {
		it('should set isSaving during save', async () => {
			component.filename.set('renamed.jpg');

			const savePromise = component.save();

			expect(component.isSaving()).toBe(true);

			const req = httpMock.expectOne('/api/media/media-1');
			req.flush({
				doc: {
					id: 'media-1',
					filename: 'renamed.jpg',
					mimeType: 'image/jpeg',
					path: '/uploads/photo.jpg',
				},
			});

			await savePromise;
			expect(component.isSaving()).toBe(false);
		});

		it('should close dialog with updated result on success', async () => {
			component.filename.set('renamed.jpg');

			const savePromise = component.save();

			const req = httpMock.expectOne('/api/media/media-1');
			req.flush({
				doc: {
					id: 'media-1',
					filename: 'renamed.jpg',
					mimeType: 'image/jpeg',
					path: '/uploads/photo.jpg',
				},
			});

			await savePromise;
			expect(mockDialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ updated: true }));
		});

		it('should close dialog with updated:true even when result is not MediaEditItem', async () => {
			component.filename.set('renamed.jpg');

			const savePromise = component.save();

			const req = httpMock.expectOne('/api/media/media-1');
			// Return something that is not a valid MediaEditItem (no doc wrapper, doc is null-ish)
			req.flush({ doc: { success: true } });

			await savePromise;
			expect(mockDialogRef.close).toHaveBeenCalledWith({ updated: true });
		});

		it('should set saveError on failure', async () => {
			component.filename.set('renamed.jpg');

			const savePromise = component.save();

			const req = httpMock.expectOne('/api/media/media-1');
			req.error(new ProgressEvent('error'));

			await savePromise;
			expect(component.saveError()).toBeTruthy();
			expect(component.isSaving()).toBe(false);
		});

		it('should update alt text', async () => {
			component.altText.set('New description');

			const savePromise = component.save();

			const req = httpMock.expectOne('/api/media/media-1');
			expect(req.request.body).toEqual(
				expect.objectContaining({
					alt: 'New description',
				}),
			);
			req.flush({
				doc: {
					id: 'media-1',
					filename: 'photo.jpg',
					mimeType: 'image/jpeg',
					path: '/uploads/photo.jpg',
					alt: 'New description',
				},
			});

			await savePromise;
		});
	});
});

describe('MediaEditDialog - file size formatting', () => {
	const createWithMedia = async (media: MediaEditItem): Promise<MediaEditDialog> => {
		await TestBed.configureTestingModule({
			imports: [MediaEditDialog],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: DIALOG_DATA, useValue: { media } },
				{ provide: DialogRef, useValue: { close: vi.fn() } },
			],
		}).compileComponents();

		const fixture = TestBed.createComponent(MediaEditDialog);
		return fixture.componentInstance;
	};

	it('should format bytes', async () => {
		const comp = await createWithMedia({ ...mockMedia, filesize: 512 });
		expect(comp.formattedSize).toBe('512 bytes');
	});

	it('should format KB', async () => {
		const comp = await createWithMedia({ ...mockMedia, filesize: 1024 * 5 });
		expect(comp.formattedSize).toBe('5.0 KB');
	});

	it('should format MB', async () => {
		const comp = await createWithMedia({ ...mockMedia, filesize: 1024 * 1024 * 2 });
		expect(comp.formattedSize).toBe('2.0 MB');
	});

	it('should format GB', async () => {
		const comp = await createWithMedia({ ...mockMedia, filesize: 1024 * 1024 * 1024 * 1.5 });
		expect(comp.formattedSize).toBe('1.5 GB');
	});

	it('should show unknown for undefined filesize', async () => {
		const comp = await createWithMedia({ ...mockMedia, filesize: undefined });
		expect(comp.formattedSize).toBe('Unknown size');
	});

	it('should show unknown for zero filesize', async () => {
		const comp = await createWithMedia({ ...mockMedia, filesize: 0 });
		expect(comp.formattedSize).toBe('Unknown size');
	});
});
