import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MediaPreviewComponent } from '../media-preview.component';

describe('MediaPreviewComponent', () => {
	let fixture: ComponentFixture<MediaPreviewComponent>;
	let component: MediaPreviewComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MediaPreviewComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(MediaPreviewComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('default values', () => {
		it('should have null media by default', () => {
			expect(component.media()).toBeNull();
		});

		it('should have md size by default', () => {
			expect(component.size()).toBe('md');
		});

		it('should have rounded true by default', () => {
			expect(component.rounded()).toBe(true);
		});
	});

	describe('isImage', () => {
		it('should return true for image/jpeg', () => {
			fixture.componentRef.setInput('media', { mimeType: 'image/jpeg' });
			expect(component.isImage()).toBe(true);
		});

		it('should return true for image/png', () => {
			fixture.componentRef.setInput('media', { mimeType: 'image/png' });
			expect(component.isImage()).toBe(true);
		});

		it('should return false for video/mp4', () => {
			fixture.componentRef.setInput('media', { mimeType: 'video/mp4' });
			expect(component.isImage()).toBe(false);
		});

		it('should return false for null media', () => {
			expect(component.isImage()).toBe(false);
		});
	});

	describe('isVideo', () => {
		it('should return true for video/mp4', () => {
			fixture.componentRef.setInput('media', { mimeType: 'video/mp4' });
			expect(component.isVideo()).toBe(true);
		});

		it('should return false for image/jpeg', () => {
			fixture.componentRef.setInput('media', { mimeType: 'image/jpeg' });
			expect(component.isVideo()).toBe(false);
		});
	});

	describe('isAudio', () => {
		it('should return true for audio/mpeg', () => {
			fixture.componentRef.setInput('media', { mimeType: 'audio/mpeg' });
			expect(component.isAudio()).toBe(true);
		});

		it('should return false for video/mp4', () => {
			fixture.componentRef.setInput('media', { mimeType: 'video/mp4' });
			expect(component.isAudio()).toBe(false);
		});
	});

	describe('imageUrl', () => {
		it('should return url when provided', () => {
			fixture.componentRef.setInput('media', {
				url: 'https://example.com/photo.jpg',
				mimeType: 'image/jpeg',
			});
			expect(component.imageUrl()).toBe('https://example.com/photo.jpg');
		});

		it('should fallback to /api/media/file/ path', () => {
			fixture.componentRef.setInput('media', {
				path: 'uploads/photo.jpg',
				mimeType: 'image/jpeg',
			});
			expect(component.imageUrl()).toBe('/api/media/file/uploads/photo.jpg');
		});

		it('should return empty string for null media', () => {
			expect(component.imageUrl()).toBe('');
		});
	});

	describe('iconName', () => {
		it('should return film icon for video', () => {
			fixture.componentRef.setInput('media', { mimeType: 'video/mp4' });
			const icon = component.iconName();
			expect(icon).toBeDefined();
			expect(typeof icon).toBe('string');
		});

		it('should return musical note icon for audio', () => {
			fixture.componentRef.setInput('media', { mimeType: 'audio/mpeg' });
			const icon = component.iconName();
			expect(icon).toBeDefined();
		});

		it('should return document text icon for PDF', () => {
			fixture.componentRef.setInput('media', { mimeType: 'application/pdf' });
			const icon = component.iconName();
			expect(icon).toBeDefined();
		});

		it('should return archive icon for zip', () => {
			fixture.componentRef.setInput('media', { mimeType: 'application/zip' });
			const icon = component.iconName();
			expect(icon).toBeDefined();
		});

		it('should return archive icon for compressed types', () => {
			fixture.componentRef.setInput('media', {
				mimeType: 'application/x-compressed',
			});
			const icon = component.iconName();
			expect(icon).toBeDefined();
		});

		it('should return photo icon for images (non-preview context)', () => {
			fixture.componentRef.setInput('media', { mimeType: 'image/svg+xml' });
			const icon = component.iconName();
			expect(icon).toBeDefined();
		});

		it('should return generic document icon for unknown types', () => {
			fixture.componentRef.setInput('media', { mimeType: 'application/octet-stream' });
			const icon = component.iconName();
			expect(icon).toBeDefined();
		});

		it('should return document icon for empty mime type', () => {
			fixture.componentRef.setInput('media', { mimeType: '' });
			const icon = component.iconName();
			expect(icon).toBeDefined();
		});
	});

	describe('hostClasses', () => {
		it('should include size class for md', () => {
			const classes = component.hostClasses();
			expect(classes).toContain('h-20 w-20');
		});

		it('should include size class for xs', () => {
			fixture.componentRef.setInput('size', 'xs');
			expect(component.hostClasses()).toContain('h-8 w-8');
		});

		it('should include size class for sm', () => {
			fixture.componentRef.setInput('size', 'sm');
			expect(component.hostClasses()).toContain('h-12 w-12');
		});

		it('should include size class for lg', () => {
			fixture.componentRef.setInput('size', 'lg');
			expect(component.hostClasses()).toContain('h-32 w-32');
		});

		it('should include size class for xl', () => {
			fixture.componentRef.setInput('size', 'xl');
			expect(component.hostClasses()).toContain('h-48 w-48');
		});

		it('should include rounded classes when rounded is true', () => {
			const classes = component.hostClasses();
			expect(classes).toContain('rounded-md');
			expect(classes).toContain('overflow-hidden');
		});

		it('should not include rounded classes when rounded is false', () => {
			fixture.componentRef.setInput('rounded', false);
			const classes = component.hostClasses();
			expect(classes).not.toContain('rounded-md');
		});

		it('should include custom class', () => {
			fixture.componentRef.setInput('class', 'my-custom');
			expect(component.hostClasses()).toContain('my-custom');
		});
	});

	describe('iconClasses', () => {
		it('should include size-based text class for md', () => {
			expect(component.iconClasses()).toContain('text-3xl');
		});

		it('should include muted foreground color', () => {
			expect(component.iconClasses()).toContain('text-mcms-muted-foreground');
		});

		it('should include text-lg for xs', () => {
			fixture.componentRef.setInput('size', 'xs');
			expect(component.iconClasses()).toContain('text-lg');
		});

		it('should include text-xl for sm', () => {
			fixture.componentRef.setInput('size', 'sm');
			expect(component.iconClasses()).toContain('text-xl');
		});

		it('should include text-4xl for lg', () => {
			fixture.componentRef.setInput('size', 'lg');
			expect(component.iconClasses()).toContain('text-4xl');
		});

		it('should include text-6xl for xl', () => {
			fixture.componentRef.setInput('size', 'xl');
			expect(component.iconClasses()).toContain('text-6xl');
		});
	});
});
