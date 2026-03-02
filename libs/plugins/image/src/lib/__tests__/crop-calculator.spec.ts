import { describe, it, expect } from 'vitest';
import { calculateCoverCrop } from '../crop-calculator';

describe('calculateCoverCrop', () => {
	it('should center-crop a landscape source to a square target', () => {
		// Source: 1000x500, Target: 200x200
		// To cover 200x200, scale by height: 200/500 = 0.4
		// Scaled source: 400x200. Need to crop 200px wide from center of 400.
		// In source coords: crop width = 200/0.4 = 500, crop height = 500
		// x = (1000 - 500) / 2 = 250
		const crop = calculateCoverCrop({ width: 1000, height: 500 }, { width: 200, height: 200 });
		expect(crop.x).toBe(250);
		expect(crop.y).toBe(0);
		expect(crop.width).toBe(500);
		expect(crop.height).toBe(500);
	});

	it('should center-crop a portrait source to a landscape target', () => {
		// Source: 400x800, Target: 800x400
		// Scale by width: 800/400 = 2.0
		// Scaled source: 800x1600. Need to crop 400 from 1600 height.
		// In source coords: crop width = 400, crop height = 400/2.0 = 200
		// y = (800 - 200) / 2 = 300
		const crop = calculateCoverCrop({ width: 400, height: 800 }, { width: 800, height: 400 });
		expect(crop.x).toBe(0);
		expect(crop.y).toBe(300);
		expect(crop.width).toBe(400);
		expect(crop.height).toBe(200);
	});

	it('should return full source when target matches source aspect ratio', () => {
		const crop = calculateCoverCrop({ width: 200, height: 200 }, { width: 200, height: 200 });
		expect(crop).toEqual({ x: 0, y: 0, width: 200, height: 200 });
	});

	it('should return full source when target is proportional', () => {
		const crop = calculateCoverCrop({ width: 400, height: 200 }, { width: 200, height: 100 });
		expect(crop).toEqual({ x: 0, y: 0, width: 400, height: 200 });
	});

	it('should shift crop window toward focal point', () => {
		// Source: 1000x500, Target: 200x200, focalPoint at right side (0.8, 0.5)
		const crop = calculateCoverCrop(
			{ width: 1000, height: 500 },
			{ width: 200, height: 200 },
			{ x: 0.8, y: 0.5 },
		);
		// Center would be x=250. Focal at 0.8 should shift right.
		expect(crop.x).toBeGreaterThan(250);
		expect(crop.y).toBe(0); // y shouldn't change since height is fully used
		expect(crop.width).toBe(500);
		expect(crop.height).toBe(500);
	});

	it('should clamp crop region to image bounds with extreme focal point', () => {
		// Focal at bottom-right corner
		const crop = calculateCoverCrop(
			{ width: 400, height: 300 },
			{ width: 200, height: 200 },
			{ x: 1.0, y: 1.0 },
		);
		expect(crop.x + crop.width).toBeLessThanOrEqual(400);
		expect(crop.y + crop.height).toBeLessThanOrEqual(300);
		expect(crop.x).toBeGreaterThanOrEqual(0);
		expect(crop.y).toBeGreaterThanOrEqual(0);
	});

	it('should clamp crop region with focal point at origin', () => {
		const crop = calculateCoverCrop(
			{ width: 400, height: 300 },
			{ width: 200, height: 200 },
			{ x: 0.0, y: 0.0 },
		);
		expect(crop.x).toBe(0);
		expect(crop.y).toBe(0);
		expect(crop.width).toBeGreaterThan(0);
		expect(crop.height).toBeGreaterThan(0);
	});

	it('should produce integer coordinates', () => {
		const crop = calculateCoverCrop(
			{ width: 333, height: 777 },
			{ width: 100, height: 100 },
			{ x: 0.33, y: 0.67 },
		);
		expect(Number.isInteger(crop.x)).toBe(true);
		expect(Number.isInteger(crop.y)).toBe(true);
		expect(Number.isInteger(crop.width)).toBe(true);
		expect(Number.isInteger(crop.height)).toBe(true);
	});

	describe('focal point validation', () => {
		const source = { width: 1000, height: 500 };
		const target = { width: 200, height: 200 };

		it('should clamp negative focal point values to 0 — equivalent to {0, 0}', () => {
			const cropNegative = calculateCoverCrop(source, target, { x: -5, y: -10 });
			const cropZero = calculateCoverCrop(source, target, { x: 0, y: 0 });
			expect(cropNegative).toEqual(cropZero);
		});

		it('should clamp focal point values greater than 1 to 1 — equivalent to {1, 1}', () => {
			const cropOver = calculateCoverCrop(source, target, { x: 5, y: 10 });
			const cropOne = calculateCoverCrop(source, target, { x: 1, y: 1 });
			expect(cropOver).toEqual(cropOne);
		});

		it('should fall back Infinity to center — non-finite values default to 0.5', () => {
			const cropInf = calculateCoverCrop(source, target, { x: Infinity, y: Infinity });
			const cropCenter = calculateCoverCrop(source, target, { x: 0.5, y: 0.5 });
			expect(cropInf).toEqual(cropCenter);
		});

		it('should fall back NaN to center — equivalent to {0.5, 0.5}', () => {
			const cropNaN = calculateCoverCrop(source, target, { x: NaN, y: NaN });
			const cropCenter = calculateCoverCrop(source, target, { x: 0.5, y: 0.5 });
			expect(cropNaN).toEqual(cropCenter);
		});

		it('should fall back -Infinity to center — non-finite values default to 0.5', () => {
			const cropNegInf = calculateCoverCrop(source, target, { x: -Infinity, y: -Infinity });
			const cropCenter = calculateCoverCrop(source, target, { x: 0.5, y: 0.5 });
			expect(cropNegInf).toEqual(cropCenter);
		});

		it('should clamp extreme finite float values to 1 — equivalent to {1, 1}', () => {
			const cropExtreme = calculateCoverCrop(source, target, { x: 1e308, y: 1e308 });
			const cropOne = calculateCoverCrop(source, target, { x: 1, y: 1 });
			expect(cropExtreme).toEqual(cropOne);
		});
	});
});
