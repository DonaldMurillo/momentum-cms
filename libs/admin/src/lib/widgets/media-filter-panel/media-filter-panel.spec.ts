import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import {
	MediaFilterPanelComponent,
	buildFilterWhere,
	SIZE_PRESETS,
	type MediaFilterState,
} from './media-filter-panel.component';

@Component({
	selector: 'test-host',
	imports: [MediaFilterPanelComponent],
	template: ` <mcms-media-filter-panel (filterChanged)="onFilter($event)" /> `,
})
class TestHost {
	readonly lastFilter = signal<MediaFilterState | null>(null);

	onFilter(state: MediaFilterState): void {
		this.lastFilter.set(state);
	}
}

describe('MediaFilterPanelComponent', () => {
	let fixture: ComponentFixture<TestHost>;
	let host: TestHost;
	let component: MediaFilterPanelComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHost);
		host = fixture.componentInstance;
		component = fixture.debugElement.children[0].componentInstance as MediaFilterPanelComponent;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should be collapsed by default', () => {
		expect(component.isExpanded()).toBe(false);
		expect(fixture.nativeElement.querySelector('[data-slot="panel"]')).toBeNull();
	});

	it('should toggle expansion on click', () => {
		const toggle = fixture.nativeElement.querySelector('[data-slot="toggle"]');
		toggle.click();
		fixture.detectChanges();
		expect(component.isExpanded()).toBe(true);
		expect(fixture.nativeElement.querySelector('[data-slot="panel"]')).toBeTruthy();
	});

	it('should render MIME category buttons when expanded', () => {
		component.isExpanded.set(true);
		fixture.detectChanges();

		const buttons = fixture.nativeElement.querySelectorAll('[data-mime]');
		expect(buttons.length).toBe(5);
	});

	it('should toggle MIME category', () => {
		component.isExpanded.set(true);
		fixture.detectChanges();

		const imageBtn = fixture.nativeElement.querySelector('[data-mime="image"]');
		imageBtn.click();
		fixture.detectChanges();

		expect(component.selectedMime()).toBe('image');
		expect(host.lastFilter()?.mimeCategory).toBe('image');
	});

	it('should deselect MIME category on second click', () => {
		component.isExpanded.set(true);
		fixture.detectChanges();

		const imageBtn = fixture.nativeElement.querySelector('[data-mime="image"]');
		imageBtn.click();
		fixture.detectChanges();

		imageBtn.click();
		fixture.detectChanges();

		expect(component.selectedMime()).toBeNull();
	});

	it('should render size preset buttons when expanded', () => {
		component.isExpanded.set(true);
		fixture.detectChanges();

		const buttons = fixture.nativeElement.querySelectorAll('[data-size]');
		expect(buttons.length).toBe(4);
	});

	it('should toggle size preset', () => {
		component.isExpanded.set(true);
		fixture.detectChanges();

		const sizeBtn = fixture.nativeElement.querySelector('[data-size="< 1 MB"]');
		sizeBtn.click();
		fixture.detectChanges();

		expect(component.selectedSize()?.label).toBe('< 1 MB');
		expect(host.lastFilter()?.sizePreset?.lte).toBe(1024 * 1024);
	});

	it('should show active filter count', () => {
		expect(component.activeFilterCount()).toBe(0);

		component.selectedMime.set('image');
		expect(component.activeFilterCount()).toBe(1);

		component.selectedSize.set(SIZE_PRESETS[0]);
		expect(component.activeFilterCount()).toBe(2);
	});

	it('should have aria-expanded on toggle', () => {
		const toggle = fixture.nativeElement.querySelector('[data-slot="toggle"]');
		expect(toggle.getAttribute('aria-expanded')).toBe('false');

		toggle.click();
		fixture.detectChanges();
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
	});

	it('should have aria-pressed on filter buttons', () => {
		component.isExpanded.set(true);
		fixture.detectChanges();

		const imageBtn = fixture.nativeElement.querySelector('[data-mime="image"]');
		expect(imageBtn.getAttribute('aria-pressed')).toBe('false');

		imageBtn.click();
		fixture.detectChanges();
		expect(imageBtn.getAttribute('aria-pressed')).toBe('true');
	});
});

describe('buildFilterWhere', () => {
	it('should return empty where for no filters', () => {
		const where = buildFilterWhere({ mimeCategory: null, dateRange: null, sizePreset: null });
		expect(Object.keys(where).length).toBe(0);
	});

	it('should add mimeType like clause for image category', () => {
		const where = buildFilterWhere({ mimeCategory: 'image', dateRange: null, sizePreset: null });
		expect(where['mimeType']).toEqual({ like: 'image/%' });
	});

	it('should add mimeType like clause for document category', () => {
		const where = buildFilterWhere({ mimeCategory: 'document', dateRange: null, sizePreset: null });
		expect(where['mimeType']).toEqual({ like: 'application/%' });
	});

	it('should add createdAt range for date filter', () => {
		const start = new Date(2025, 0, 1);
		const end = new Date(2025, 0, 31);
		const where = buildFilterWhere({
			mimeCategory: null,
			dateRange: { start, end },
			sizePreset: null,
		});
		expect(where['createdAt']).toEqual({
			gte: start.toISOString(),
			lte: end.toISOString(),
		});
	});

	it('should add filesize constraints for size preset', () => {
		const where = buildFilterWhere({
			mimeCategory: null,
			dateRange: null,
			sizePreset: SIZE_PRESETS[1], // 1-10 MB
		});
		expect(where['filesize']).toEqual({
			gte: 1024 * 1024,
			lte: 10 * 1024 * 1024,
		});
	});

	it('should combine multiple filters', () => {
		const where = buildFilterWhere({
			mimeCategory: 'video',
			dateRange: { start: new Date(2025, 0, 1), end: new Date(2025, 0, 31) },
			sizePreset: SIZE_PRESETS[0],
		});
		expect(where['mimeType']).toBeDefined();
		expect(where['createdAt']).toBeDefined();
		expect(where['filesize']).toBeDefined();
	});
});
