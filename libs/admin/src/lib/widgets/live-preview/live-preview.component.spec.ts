import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LivePreviewComponent } from './live-preview.component';

describe('LivePreviewComponent', () => {
	let fixture: ComponentFixture<LivePreviewComponent>;
	let component: LivePreviewComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [LivePreviewComponent],
		}).compileComponents();
	});

	function createFixture(
		preview: boolean | string | ((doc: Record<string, unknown>) => string),
		documentData: Record<string, unknown>,
		collectionSlug: string,
		entityId?: string,
	): void {
		fixture = TestBed.createComponent(LivePreviewComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('preview', preview);
		fixture.componentRef.setInput('documentData', documentData);
		fixture.componentRef.setInput('collectionSlug', collectionSlug);
		if (entityId) {
			fixture.componentRef.setInput('entityId', entityId);
		}
	}

	describe('previewUrl', () => {
		it('should compute URL for boolean preview with entityId', () => {
			createFixture(true, { id: '1' }, 'pages', '1');
			fixture.detectChanges();
			expect(component.previewUrl()).toBe('/api/pages/1/preview');
		});

		it('should return null for boolean preview without entityId', () => {
			createFixture(true, { id: '1' }, 'pages');
			fixture.detectChanges();
			expect(component.previewUrl()).toBeNull();
		});

		it('should compute URL for function preview', () => {
			const fn = (doc: Record<string, unknown>): string => `/preview/${String(doc['slug'])}`;
			createFixture(fn, { slug: 'test-article' }, 'articles', '1');
			fixture.detectChanges();
			expect(component.previewUrl()).toBe('/preview/test-article');
		});

		it('should return null for string template with empty field', () => {
			createFixture('/posts/{slug}', { title: 'Test' }, 'posts', '1');
			fixture.detectChanges();
			expect(component.previewUrl()).toBeNull();
		});
	});

	describe('iframeWidth', () => {
		it('should return 100% for desktop', () => {
			createFixture(true, {}, 'pages', '1');
			fixture.detectChanges();
			expect(component.iframeWidth()).toBe('100%');
		});

		it('should return 768px for tablet', () => {
			createFixture(true, {}, 'pages', '1');
			fixture.detectChanges();
			component.deviceSize.set('tablet');
			expect(component.iframeWidth()).toBe('768px');
		});

		it('should return 375px for mobile', () => {
			createFixture(true, {}, 'pages', '1');
			fixture.detectChanges();
			component.deviceSize.set('mobile');
			expect(component.iframeWidth()).toBe('375px');
		});
	});
});
