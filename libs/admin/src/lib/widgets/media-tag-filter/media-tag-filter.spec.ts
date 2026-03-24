import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { MediaTagFilterComponent, type MediaTag } from './media-tag-filter.component';

const TAGS: MediaTag[] = [
	{ id: 't1', name: 'Nature', color: '#22c55e' },
	{ id: 't2', name: 'Portrait', color: '#3b82f6' },
	{ id: 't3', name: 'Archive' },
];

@Component({
	selector: 'test-host',
	imports: [MediaTagFilterComponent],
	template: `
		<mcms-media-tag-filter
			[tags]="tags()"
			[selectedTagIds]="selectedIds()"
			(tagSelectionChanged)="onChanged($event)"
			(createTagClicked)="createCount.set(createCount() + 1)"
		/>
	`,
})
class TestHost {
	readonly tags = signal<MediaTag[]>(TAGS);
	readonly selectedIds = signal<Set<string>>(new Set());
	readonly lastEmitted = signal<Set<string>>(new Set());
	readonly createCount = signal(0);

	onChanged(ids: Set<string>): void {
		this.lastEmitted.set(ids);
		this.selectedIds.set(ids);
	}
}

describe('MediaTagFilterComponent', () => {
	let fixture: ComponentFixture<TestHost>;
	let host: TestHost;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHost);
		host = fixture.componentInstance;
		fixture.detectChanges();
	});

	function getTagButtons(): HTMLButtonElement[] {
		return Array.from(fixture.nativeElement.querySelectorAll('[data-tag-id]'));
	}

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render all tags', () => {
		const buttons = getTagButtons();
		expect(buttons.length).toBe(3);
	});

	it('should display tag names', () => {
		const buttons = getTagButtons();
		expect(buttons[0].textContent).toContain('Nature');
		expect(buttons[1].textContent).toContain('Portrait');
		expect(buttons[2].textContent).toContain('Archive');
	});

	it('should toggle tag selection', () => {
		const buttons = getTagButtons();
		buttons[0].click();
		fixture.detectChanges();

		expect(host.lastEmitted().has('t1')).toBe(true);
	});

	it('should deselect on second click', () => {
		const buttons = getTagButtons();
		buttons[0].click();
		fixture.detectChanges();

		// Click again to deselect
		const updatedButtons = getTagButtons();
		updatedButtons[0].click();
		fixture.detectChanges();

		expect(host.lastEmitted().has('t1')).toBe(false);
	});

	it('should support multi-select', () => {
		const buttons = getTagButtons();
		buttons[0].click();
		fixture.detectChanges();

		const updatedButtons = getTagButtons();
		updatedButtons[1].click();
		fixture.detectChanges();

		expect(host.lastEmitted().has('t1')).toBe(true);
		expect(host.lastEmitted().has('t2')).toBe(true);
	});

	it('should show aria-pressed for selected tags', () => {
		host.selectedIds.set(new Set(['t1']));
		fixture.detectChanges();

		const buttons = getTagButtons();
		expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
		expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
	});

	it('should have role="group" on container', () => {
		const group = fixture.nativeElement.querySelector('[role="group"]');
		expect(group).toBeTruthy();
	});

	it('should render color dots for tags with color', () => {
		fixture.nativeElement.querySelectorAll('[aria-hidden="true"] + *');
		// Tags with color have a color dot span
		const colorDots = fixture.nativeElement.querySelectorAll('.rounded-full:not(button)');
		// Nature and Portrait have colors, Archive doesn't
		expect(colorDots.length).toBeGreaterThanOrEqual(2);
	});

	it('should emit createTagClicked', () => {
		const createBtn = fixture.nativeElement.querySelector('[data-slot="create-tag"]');
		createBtn.click();
		fixture.detectChanges();
		expect(host.createCount()).toBe(1);
	});

	it('should return correct contrast color for dark backgrounds', () => {
		const component = fixture.debugElement.children[0].componentInstance as MediaTagFilterComponent;
		expect(component.getContrastColor('#000000')).toBe('#ffffff');
		expect(component.getContrastColor('#ffffff')).toBe('#000000');
	});
});
