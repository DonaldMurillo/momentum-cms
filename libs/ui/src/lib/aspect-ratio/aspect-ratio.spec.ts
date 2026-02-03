import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AspectRatio } from './aspect-ratio.component';

describe('AspectRatio', () => {
	let fixture: ComponentFixture<AspectRatio>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AspectRatio],
		}).compileComponents();

		fixture = TestBed.createComponent(AspectRatio);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have default ratio of 16/9', () => {
		expect(fixture.componentInstance.ratio()).toBeCloseTo(16 / 9);
	});

	it('should apply aspect-ratio style', () => {
		const ratio = fixture.nativeElement.style.aspectRatio;
		expect(parseFloat(ratio)).toBeCloseTo(16 / 9);
	});

	it('should update aspect-ratio when ratio changes', () => {
		fixture.componentRef.setInput('ratio', 4 / 3);
		fixture.detectChanges();
		const ratio = fixture.nativeElement.style.aspectRatio;
		expect(parseFloat(ratio)).toBeCloseTo(4 / 3);
	});

	it('should support square ratio', () => {
		fixture.componentRef.setInput('ratio', 1);
		fixture.detectChanges();
		const ratio = fixture.nativeElement.style.aspectRatio;
		expect(parseFloat(ratio)).toBe(1);
	});

	it('should be relative positioned', () => {
		expect(fixture.nativeElement.classList.contains('relative')).toBe(true);
	});

	it('should be full width', () => {
		expect(fixture.nativeElement.classList.contains('w-full')).toBe(true);
	});

	it('should be a block element', () => {
		expect(fixture.nativeElement.classList.contains('block')).toBe(true);
	});

	it('should include custom classes', () => {
		fixture.componentRef.setInput('class', 'overflow-hidden rounded-lg');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('overflow-hidden')).toBe(true);
		expect(fixture.nativeElement.classList.contains('rounded-lg')).toBe(true);
	});
});
