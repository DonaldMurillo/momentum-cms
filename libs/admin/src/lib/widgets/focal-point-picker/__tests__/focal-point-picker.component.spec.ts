import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FocalPointPickerComponent } from '../focal-point-picker.component';

describe('FocalPointPickerComponent', () => {
	let fixture: ComponentFixture<FocalPointPickerComponent>;
	let component: FocalPointPickerComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FocalPointPickerComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(FocalPointPickerComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('imageUrl', 'https://example.com/photo.jpg');
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('default values', () => {
		it('should have center focal point by default', () => {
			expect(component.focalPoint()).toEqual({ x: 0.5, y: 0.5 });
		});

		it('should have empty alt by default', () => {
			expect(component.alt()).toBe('');
		});

		it('should have zero natural dimensions by default', () => {
			expect(component.naturalWidth()).toBe(0);
			expect(component.naturalHeight()).toBe(0);
		});

		it('should have empty imageSizes by default', () => {
			expect(component.imageSizes()).toEqual([]);
		});
	});

	describe('computed values', () => {
		it('should compute focalPointX as percentage', () => {
			fixture.componentRef.setInput('focalPoint', { x: 0.25, y: 0.75 });
			expect(component.focalPointX()).toBe(25);
		});

		it('should compute focalPointY as percentage', () => {
			fixture.componentRef.setInput('focalPoint', { x: 0.25, y: 0.75 });
			expect(component.focalPointY()).toBe(75);
		});

		it('should compute cssPosition from focal point', () => {
			fixture.componentRef.setInput('focalPoint', { x: 0.3, y: 0.7 });
			expect(component.cssPosition()).toBe('30% 70%');
		});

		it('should compute positionLabel', () => {
			fixture.componentRef.setInput('focalPoint', { x: 0.5, y: 0.5 });
			expect(component.positionLabel()).toBe('50% x 50%');
		});
	});

	describe('cropPreviews', () => {
		it('should return empty when no natural dimensions', () => {
			fixture.componentRef.setInput('imageSizes', [
				{ name: 'thumb', width: 150, height: 150, fit: 'cover' },
			]);
			expect(component.cropPreviews()).toEqual([]);
		});

		it('should return empty when no image sizes', () => {
			fixture.componentRef.setInput('naturalWidth', 800);
			fixture.componentRef.setInput('naturalHeight', 600);
			expect(component.cropPreviews()).toEqual([]);
		});

		it('should calculate crop previews for cover-fit sizes', () => {
			fixture.componentRef.setInput('naturalWidth', 200);
			fixture.componentRef.setInput('naturalHeight', 100);
			fixture.componentRef.setInput('focalPoint', { x: 0.5, y: 0.5 });
			fixture.componentRef.setInput('imageSizes', [
				{ name: 'thumb', width: 50, height: 50, fit: 'cover' as const },
			]);

			const previews = component.cropPreviews();
			expect(previews).toHaveLength(1);
			expect(previews[0].name).toBe('thumb');
			// 200x100 → 50x50 cover: scale = max(50/200, 50/100) = 0.5
			// cropW = 50/0.5 = 100, cropH = 50/0.5 = 100
			// x = 50, y = 0
			expect(previews[0].widthPct).toBe(50); // 100/200 * 100
			expect(previews[0].heightPct).toBe(100); // 100/100 * 100
		});

		it('should skip non-cover sizes', () => {
			fixture.componentRef.setInput('naturalWidth', 200);
			fixture.componentRef.setInput('naturalHeight', 100);
			fixture.componentRef.setInput('imageSizes', [
				{ name: 'scaled', width: 100, fit: 'width' as const },
			]);

			expect(component.cropPreviews()).toEqual([]);
		});
	});

	describe('onResetCenter', () => {
		it('should emit center focal point', () => {
			const emitted: { x: number; y: number }[] = [];
			component.focalPointChange.subscribe((fp) => emitted.push(fp));

			component.onResetCenter();

			expect(emitted).toEqual([{ x: 0.5, y: 0.5 }]);
		});
	});

	describe('onNudge', () => {
		it('should nudge focal point by delta', () => {
			fixture.componentRef.setInput('focalPoint', { x: 0.5, y: 0.5 });

			const emitted: { x: number; y: number }[] = [];
			component.focalPointChange.subscribe((fp) => emitted.push(fp));

			const event = new Event('keydown');
			event.preventDefault = vi.fn();
			component.onNudge(0.05, 0, event);

			expect(emitted).toHaveLength(1);
			expect(emitted[0].x).toBeCloseTo(0.55);
			expect(emitted[0].y).toBeCloseTo(0.5);
		});

		it('should clamp nudge within 0-1 range', () => {
			fixture.componentRef.setInput('focalPoint', { x: 0.98, y: 0.02 });

			const emitted: { x: number; y: number }[] = [];
			component.focalPointChange.subscribe((fp) => emitted.push(fp));

			const event = new Event('keydown');
			event.preventDefault = vi.fn();
			component.onNudge(0.05, -0.05, event);

			expect(emitted[0].x).toBe(1);
			expect(emitted[0].y).toBe(0);
		});
	});
});
